const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserBlock = sequelize.define('UserBlock', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    blockerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'blocker_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    blockedId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'blocked_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.ENUM(
        'inappropriate_behavior',
        'spam',
        'harassment',
        'unreliable',
        'fraud_concern',
        'safety_concern',
        'other'
      ),
      allowNull: true
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    unblockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'unblocked_at'
    },
    unblockedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'unblocked_reason'
    }
  }, {
    tableName: 'user_blocks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['blocker_id']
      },
      {
        fields: ['blocked_id']
      },
      {
        fields: ['blocker_id', 'blocked_id'],
        unique: true
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['reason']
      },
      {
        fields: ['created_at']
      }
    ],
    validate: {
      // Prevent users from blocking themselves
      cannotBlockSelf() {
        if (this.blockerId === this.blockedId) {
          throw new Error('Users cannot block themselves');
        }
      }
    },
    hooks: {
      beforeUpdate: (block) => {
        // Set unblocked timestamp when deactivating
        if (block.changed('isActive') && !block.isActive) {
          block.unblockedAt = new Date();
        }
      }
    }
  });

  // Instance methods
  UserBlock.prototype.unblock = function(reason = null) {
    this.isActive = false;
    this.unblockedAt = new Date();
    this.unblockedReason = reason;
    return this;
  };

  UserBlock.prototype.reactivate = function() {
    this.isActive = true;
    this.unblockedAt = null;
    this.unblockedReason = null;
    return this;
  };

  UserBlock.prototype.getDuration = function() {
    const endDate = this.unblockedAt || new Date();
    return Math.floor((endDate - this.createdAt) / (1000 * 60 * 60 * 24)); // days
  };

  // Class methods
  UserBlock.findByBlockerId = function(blockerId, activeOnly = true) {
    const where = { blockerId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'BlockedUser',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  UserBlock.findByBlockedId = function(blockedId, activeOnly = true) {
    const where = { blockedId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'Blocker',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  UserBlock.isBlocked = async function(blockerId, blockedId) {
    const block = await this.findOne({
      where: {
        blockerId,
        blockedId,
        isActive: true
      }
    });
    
    return !!block;
  };

  UserBlock.isBlockedEitherWay = async function(userId1, userId2) {
    const blocks = await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { blockerId: userId1, blockedId: userId2 },
          { blockerId: userId2, blockedId: userId1 }
        ],
        isActive: true
      }
    });
    
    return blocks.length > 0;
  };

  UserBlock.blockUser = async function(blockerId, blockedId, reason = null, comment = null) {
    // Check if block already exists
    const existingBlock = await this.findOne({
      where: { blockerId, blockedId }
    });

    if (existingBlock) {
      if (existingBlock.isActive) {
        throw new Error('User is already blocked');
      } else {
        // Reactivate existing block
        existingBlock.reactivate();
        existingBlock.reason = reason;
        existingBlock.comment = comment;
        await existingBlock.save();
        return existingBlock;
      }
    }

    // Create new block
    return this.create({
      blockerId,
      blockedId,
      reason,
      comment
    });
  };

  UserBlock.unblockUser = async function(blockerId, blockedId, reason = null) {
    const block = await this.findOne({
      where: {
        blockerId,
        blockedId,
        isActive: true
      }
    });

    if (!block) {
      throw new Error('No active block found');
    }

    block.unblock(reason);
    await block.save();
    return block;
  };

  UserBlock.getBlockStats = function(userId = null) {
    const where = {};
    if (userId) {
      where[sequelize.Sequelize.Op.or] = [
        { blockerId: userId },
        { blockedId: userId }
      ];
    }
    where.isActive = true;

    return this.findAll({
      where,
      attributes: [
        'reason',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['reason'],
      raw: true
    });
  };

  UserBlock.getMutualBlocks = function(userIds) {
    return this.findAll({
      where: {
        blockerId: { [sequelize.Sequelize.Op.in]: userIds },
        blockedId: { [sequelize.Sequelize.Op.in]: userIds },
        isActive: true
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'Blocker',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: sequelize.models.User,
          as: 'BlockedUser',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
  };

  UserBlock.cleanupOldBlocks = async function(daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.destroy({
      where: {
        isActive: false,
        unblockedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    return result;
  };

  // Associations
  UserBlock.associate = function(models) {
    UserBlock.belongsTo(models.User, {
      foreignKey: 'blocker_id',
      as: 'Blocker'
    });

    UserBlock.belongsTo(models.User, {
      foreignKey: 'blocked_id',
      as: 'BlockedUser'
    });
  };

  return UserBlock;
};