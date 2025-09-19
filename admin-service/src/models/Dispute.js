module.exports = (sequelize, DataTypes) => {
  const Dispute = sequelize.define('Dispute', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    delivery_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to delivery in delivery service'
    },
    payment_intent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to payment intent in payment service'
    },
    case_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Human-readable case number (e.g., DISP-2025-001234)'
    },
    category: {
      type: DataTypes.ENUM(
        'item_not_delivered',
        'item_damaged',
        'service_not_as_described',
        'unauthorized_charge',
        'payment_issue',
        'other'
      ),
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    status: {
      type: DataTypes.ENUM(
        'open',
        'under_review',
        'awaiting_response',
        'resolved',
        'escalated',
        'closed'
      ),
      defaultValue: 'open'
    },
    complainant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID who filed the dispute'
    },
    respondent_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID who the dispute is against'
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Disputed amount in cents'
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Description of the dispute from complainant'
    },
    requested_resolution: {
      type: DataTypes.ENUM(
        'full_refund',
        'partial_refund',
        'replacement',
        'compensation',
        'no_action'
      ),
      allowNull: true,
      comment: 'What the complainant is requesting'
    },
    assignee_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin user assigned to handle this dispute'
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Target resolution date'
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin notes about the resolution'
    },
    resolution_type: {
      type: DataTypes.ENUM(
        'full_refund',
        'partial_refund',
        'replacement',
        'compensation',
        'no_action'
      ),
      allowNull: true,
      comment: 'Actual resolution applied'
    },
    resolution_amount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Amount refunded/compensated in cents'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional dispute metadata'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Tags for categorization and filtering'
    },
    is_escalated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    escalated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    escalation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'disputes',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['case_number']
      },
      {
        fields: ['delivery_id']
      },
      {
        fields: ['status', 'priority', 'created_at']
      },
      {
        fields: ['assignee_id', 'status']
      },
      {
        fields: ['complainant_id']
      },
      {
        fields: ['respondent_id']
      },
      {
        fields: ['category']
      },
      {
        fields: ['due_date']
      },
      {
        fields: ['resolved_at']
      }
    ]
  });

  Dispute.associate = (models) => {
    // Association with AdminUser (assignee)
    Dispute.belongsTo(models.AdminUser, {
      foreignKey: 'assignee_id',
      as: 'assignee'
    });

    // Association with DisputeEvidence
    Dispute.hasMany(models.DisputeEvidence, {
      foreignKey: 'dispute_id',
      as: 'evidence'
    });

    // Association with DisputeMessage
    Dispute.hasMany(models.DisputeMessage, {
      foreignKey: 'dispute_id',
      as: 'messages'
    });
  };

  // Instance methods
  Dispute.prototype.assign = async function(assigneeId, adminId, options = {}) {
    const { priority, dueDate, notes } = options;
    
    this.assignee_id = assigneeId;
    this.assigned_at = new Date();
    this.status = 'under_review';
    
    if (priority) this.priority = priority;
    if (dueDate) this.due_date = dueDate;
    
    await this.save();
    
    // Log assignment
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'dispute_assigned',
      'dispute',
      this.id,
      { assigneeId, priority, dueDate, notes }
    );
    
    return this;
  };

  Dispute.prototype.resolve = async function(resolution, adminId, options = {}) {
    const {
      resolutionNotes,
      resolutionAmount,
      notifyParties = true
    } = options;
    
    this.status = 'resolved';
    this.resolution_type = resolution;
    this.resolution_notes = resolutionNotes;
    this.resolution_amount = resolutionAmount;
    this.resolved_at = new Date();
    
    await this.save();
    
    // Log resolution
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'dispute_resolved',
      'dispute',
      this.id,
      { resolution, resolutionAmount, resolutionNotes }
    );
    
    return this;
  };

  Dispute.prototype.escalate = async function(adminId, reason) {
    this.is_escalated = true;
    this.escalated_at = new Date();
    this.escalation_reason = reason;
    this.status = 'escalated';
    this.priority = 'high'; // Auto-escalate priority
    
    await this.save();
    
    // Log escalation
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'dispute_escalated',
      'dispute',
      this.id,
      { reason }
    );
    
    return this;
  };

  Dispute.prototype.addTag = function(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      return this.save();
    }
    return Promise.resolve(this);
  };

  Dispute.prototype.removeTag = function(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    return this.save();
  };

  Dispute.prototype.isOverdue = function() {
    return this.due_date && new Date() > this.due_date && !this.resolved_at;
  };

  Dispute.prototype.getDaysOpen = function() {
    const endDate = this.resolved_at || new Date();
    return Math.ceil((endDate - this.created_at) / (1000 * 60 * 60 * 24));
  };

  // Class methods
  Dispute.generateCaseNumber = async function() {
    const year = new Date().getFullYear();
    const prefix = `DISP-${year}-`;
    
    // Find the highest case number for this year
    const lastDispute = await this.findOne({
      where: {
        case_number: {
          [sequelize.Sequelize.Op.like]: `${prefix}%`
        }
      },
      order: [['case_number', 'DESC']]
    });
    
    let nextNumber = 1;
    if (lastDispute) {
      const lastNumber = parseInt(lastDispute.case_number.split('-').pop());
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  };

  Dispute.findByStatus = function(status, options = {}) {
    const { assigneeId, priority, limit = 50, offset = 0 } = options;
    const where = { status };
    
    if (assigneeId) where.assignee_id = assigneeId;
    if (priority) where.priority = priority;
    
    return this.findAll({
      where,
      include: ['assignee', 'evidence', 'messages'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  Dispute.findOverdue = function() {
    return this.findAll({
      where: {
        due_date: {
          [sequelize.Sequelize.Op.lt]: new Date()
        },
        resolved_at: null
      },
      include: ['assignee'],
      order: [['due_date', 'ASC']]
    });
  };

  Dispute.findByAssignee = function(assigneeId, status = null) {
    const where = { assignee_id: assigneeId };
    if (status) where.status = status;
    
    return this.findAll({
      where,
      include: ['evidence', 'messages'],
      order: [['created_at', 'DESC']]
    });
  };

  Dispute.getStatsByStatus = async function(dateRange = null) {
    const where = {};
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const disputes = await this.findAll({
      where,
      attributes: ['status'],
      raw: true
    });
    
    const stats = {};
    disputes.forEach(dispute => {
      stats[dispute.status] = (stats[dispute.status] || 0) + 1;
    });
    
    return stats;
  };

  Dispute.getStatsByCategory = async function(dateRange = null) {
    const where = {};
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const disputes = await this.findAll({
      where,
      attributes: ['category'],
      raw: true
    });
    
    const stats = {};
    disputes.forEach(dispute => {
      stats[dispute.category] = (stats[dispute.category] || 0) + 1;
    });
    
    return stats;
  };

  Dispute.getAverageResolutionTime = async function(dateRange = null) {
    const where = {
      resolved_at: { [sequelize.Sequelize.Op.not]: null }
    };
    
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const disputes = await this.findAll({
      where,
      attributes: ['created_at', 'resolved_at'],
      raw: true
    });
    
    if (disputes.length === 0) return 0;
    
    const totalHours = disputes.reduce((sum, dispute) => {
      const hours = (new Date(dispute.resolved_at) - new Date(dispute.created_at)) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    
    return totalHours / disputes.length;
  };

  Dispute.searchDisputes = function(searchTerm, options = {}) {
    const { status, category, assigneeId, limit = 50 } = options;
    const where = {
      [sequelize.Sequelize.Op.or]: [
        { case_number: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
        { description: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
        { resolution_notes: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
      ]
    };
    
    if (status) where.status = status;
    if (category) where.category = category;
    if (assigneeId) where.assignee_id = assigneeId;
    
    return this.findAll({
      where,
      include: ['assignee', 'evidence'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  return Dispute;
};