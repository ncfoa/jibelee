module.exports = (sequelize, DataTypes) => {
  const DisputeMessage = sequelize.define('DisputeMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    dispute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the dispute'
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID who sent this message'
    },
    sender_type: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
      comment: 'Type of sender (user or admin)'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Message content'
    },
    message_type: {
      type: DataTypes.ENUM('text', 'system', 'notification', 'update'),
      defaultValue: 'text',
      comment: 'Type of message'
    },
    is_internal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is an internal admin note'
    },
    is_automated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this message was generated automatically'
    },
    parent_message_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to parent message for threading'
    },
    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of attachment objects'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional message metadata'
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the message has been read by recipient'
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    read_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Who marked this message as read'
    },
    is_flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this message is flagged for attention'
    },
    flagged_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Reason for flagging'
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Soft delete flag'
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin who deleted this message'
    }
  }, {
    tableName: 'dispute_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['dispute_id', 'created_at']
      },
      {
        fields: ['sender_id']
      },
      {
        fields: ['sender_type']
      },
      {
        fields: ['is_internal']
      },
      {
        fields: ['is_read']
      },
      {
        fields: ['is_flagged']
      },
      {
        fields: ['is_deleted']
      },
      {
        fields: ['parent_message_id']
      }
    ]
  });

  DisputeMessage.associate = (models) => {
    // Association with Dispute
    DisputeMessage.belongsTo(models.Dispute, {
      foreignKey: 'dispute_id',
      as: 'dispute'
    });

    // Association with AdminUser (read_by)
    DisputeMessage.belongsTo(models.AdminUser, {
      foreignKey: 'read_by',
      as: 'readBy'
    });

    // Association with AdminUser (deleted_by)
    DisputeMessage.belongsTo(models.AdminUser, {
      foreignKey: 'deleted_by',
      as: 'deletedBy'
    });

    // Self-referencing association for threading
    DisputeMessage.belongsTo(DisputeMessage, {
      foreignKey: 'parent_message_id',
      as: 'parentMessage'
    });

    DisputeMessage.hasMany(DisputeMessage, {
      foreignKey: 'parent_message_id',
      as: 'replies'
    });
  };

  // Instance methods
  DisputeMessage.prototype.markAsRead = async function(readerId) {
    this.is_read = true;
    this.read_at = new Date();
    this.read_by = readerId;
    
    return await this.save();
  };

  DisputeMessage.prototype.flag = async function(reason, adminId) {
    this.is_flagged = true;
    this.flagged_reason = reason;
    
    await this.save();
    
    // Log flagging
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'message_flagged',
      'dispute_message',
      this.id,
      { disputeId: this.dispute_id, reason }
    );
    
    return this;
  };

  DisputeMessage.prototype.unflag = async function(adminId) {
    this.is_flagged = false;
    this.flagged_reason = null;
    
    await this.save();
    
    // Log unflagging
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'message_unflagged',
      'dispute_message',
      this.id,
      { disputeId: this.dispute_id }
    );
    
    return this;
  };

  DisputeMessage.prototype.softDelete = async function(adminId, reason = null) {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.deleted_by = adminId;
    
    await this.save();
    
    // Log deletion
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'message_deleted',
      'dispute_message',
      this.id,
      { disputeId: this.dispute_id, reason }
    );
    
    return this;
  };

  DisputeMessage.prototype.restore = async function(adminId) {
    this.is_deleted = false;
    this.deleted_at = null;
    this.deleted_by = null;
    
    await this.save();
    
    // Log restoration
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'message_restored',
      'dispute_message',
      this.id,
      { disputeId: this.dispute_id }
    );
    
    return this;
  };

  DisputeMessage.prototype.addAttachment = function(attachment) {
    if (!Array.isArray(this.attachments)) {
      this.attachments = [];
    }
    
    this.attachments.push({
      id: require('uuid').v4(),
      ...attachment,
      addedAt: new Date()
    });
    
    return this.save();
  };

  DisputeMessage.prototype.removeAttachment = function(attachmentId) {
    if (Array.isArray(this.attachments)) {
      this.attachments = this.attachments.filter(att => att.id !== attachmentId);
      return this.save();
    }
    
    return Promise.resolve(this);
  };

  DisputeMessage.prototype.updateMetadata = function(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this.save();
  };

  DisputeMessage.prototype.isFromAdmin = function() {
    return this.sender_type === 'admin';
  };

  DisputeMessage.prototype.isFromUser = function() {
    return this.sender_type === 'user';
  };

  DisputeMessage.prototype.hasAttachments = function() {
    return Array.isArray(this.attachments) && this.attachments.length > 0;
  };

  DisputeMessage.prototype.getThreadLength = async function() {
    if (!this.parent_message_id) {
      // This is the root message, count all replies
      const replies = await DisputeMessage.findAll({
        where: { parent_message_id: this.id, is_deleted: false }
      });
      return replies.length + 1; // +1 for the root message
    } else {
      // This is a reply, find the root and count all messages in thread
      const rootMessage = await DisputeMessage.findByPk(this.parent_message_id);
      if (rootMessage) {
        return await rootMessage.getThreadLength();
      }
      return 1;
    }
  };

  // Class methods
  DisputeMessage.findByDispute = function(disputeId, options = {}) {
    const {
      includeDeleted = false,
      includeInternal = true,
      senderType = null,
      limit = 100,
      offset = 0
    } = options;
    
    const where = { dispute_id: disputeId };
    
    if (!includeDeleted) {
      where.is_deleted = false;
    }
    
    if (!includeInternal) {
      where.is_internal = false;
    }
    
    if (senderType) {
      where.sender_type = senderType;
    }
    
    return this.findAll({
      where,
      include: ['parentMessage', 'replies', 'readBy', 'deletedBy'],
      order: [['created_at', 'ASC']],
      limit,
      offset
    });
  };

  DisputeMessage.findBySender = function(senderId, options = {}) {
    const { includeDeleted = false, limit = 50 } = options;
    const where = { sender_id: senderId };
    
    if (!includeDeleted) {
      where.is_deleted = false;
    }
    
    return this.findAll({
      where,
      include: ['dispute'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  DisputeMessage.findUnread = function(options = {}) {
    const { senderType = null, limit = 100 } = options;
    const where = {
      is_read: false,
      is_deleted: false
    };
    
    if (senderType) {
      where.sender_type = senderType;
    }
    
    return this.findAll({
      where,
      include: ['dispute'],
      order: [['created_at', 'ASC']],
      limit
    });
  };

  DisputeMessage.findFlagged = function(options = {}) {
    const { limit = 100 } = options;
    
    return this.findAll({
      where: {
        is_flagged: true,
        is_deleted: false
      },
      include: ['dispute'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  DisputeMessage.createSystemMessage = async function(disputeId, message, metadata = {}) {
    return await this.create({
      dispute_id: disputeId,
      sender_id: null, // System messages have no sender
      sender_type: 'admin',
      message,
      message_type: 'system',
      is_internal: true,
      is_automated: true,
      metadata
    });
  };

  DisputeMessage.createNotification = async function(disputeId, message, recipientId, metadata = {}) {
    return await this.create({
      dispute_id: disputeId,
      sender_id: null,
      sender_type: 'admin',
      message,
      message_type: 'notification',
      is_internal: false,
      is_automated: true,
      metadata: { ...metadata, recipientId }
    });
  };

  DisputeMessage.getMessageStats = async function(disputeId = null, dateRange = null) {
    const where = { is_deleted: false };
    if (disputeId) where.dispute_id = disputeId;
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const messages = await this.findAll({
      where,
      attributes: ['sender_type', 'message_type', 'is_internal', 'is_read', 'is_flagged'],
      raw: true
    });
    
    const stats = {
      total: messages.length,
      bySenderType: { user: 0, admin: 0 },
      byMessageType: { text: 0, system: 0, notification: 0, update: 0 },
      internal: messages.filter(m => m.is_internal).length,
      external: messages.filter(m => !m.is_internal).length,
      read: messages.filter(m => m.is_read).length,
      unread: messages.filter(m => !m.is_read).length,
      flagged: messages.filter(m => m.is_flagged).length
    };
    
    messages.forEach(message => {
      stats.bySenderType[message.sender_type]++;
      stats.byMessageType[message.message_type]++;
    });
    
    return stats;
  };

  DisputeMessage.searchMessages = function(searchTerm, options = {}) {
    const { disputeId = null, senderType = null, includeInternal = true, limit = 50 } = options;
    const where = {
      message: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` },
      is_deleted: false
    };
    
    if (disputeId) where.dispute_id = disputeId;
    if (senderType) where.sender_type = senderType;
    if (!includeInternal) where.is_internal = false;
    
    return this.findAll({
      where,
      include: ['dispute'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  DisputeMessage.markAllAsRead = async function(disputeId, readerId) {
    const [updatedCount] = await this.update(
      {
        is_read: true,
        read_at: new Date(),
        read_by: readerId
      },
      {
        where: {
          dispute_id: disputeId,
          is_read: false,
          is_deleted: false
        }
      }
    );
    
    return updatedCount;
  };

  DisputeMessage.getConversationTimeline = async function(disputeId) {
    const messages = await this.findAll({
      where: {
        dispute_id: disputeId,
        is_deleted: false
      },
      order: [['created_at', 'ASC']]
    });
    
    // Group messages by date for timeline view
    const timeline = {};
    messages.forEach(message => {
      const date = message.created_at.toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = [];
      }
      timeline[date].push(message);
    });
    
    return timeline;
  };

  return DisputeMessage;
};