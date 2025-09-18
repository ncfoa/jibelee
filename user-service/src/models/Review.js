const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'delivery_id',
      comment: 'Reference to the delivery this review is for'
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'reviewer_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    revieweeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'reviewee_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    overallRating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'overall_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    // Category-specific ratings
    communicationRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'communication_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    punctualityRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'punctuality_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    carefulnessRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'carefulness_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    friendlinessRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'friendliness_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_anonymous'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_verified',
      comment: 'Whether this review is from a verified delivery'
    },
    status: {
      type: DataTypes.ENUM('active', 'hidden', 'deleted', 'disputed'),
      allowNull: false,
      defaultValue: 'active'
    },
    moderationStatus: {
      type: DataTypes.ENUM('approved', 'pending', 'flagged', 'removed'),
      allowNull: false,
      defaultValue: 'approved',
      field: 'moderation_status'
    },
    moderatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'moderated_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    moderatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'moderated_at'
    },
    moderationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'moderation_notes'
    },
    // Helpful/unhelpful votes
    helpfulVotes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'helpful_votes'
    },
    unhelpfulVotes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'unhelpful_votes'
    },
    // Response from reviewee
    response: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    responseAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'response_at'
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional metadata like sentiment analysis, language detection, etc.'
    },
    // Auto-generated tags
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      comment: 'Auto-generated tags based on review content'
    }
  }, {
    tableName: 'reviews',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['reviewer_id']
      },
      {
        fields: ['reviewee_id']
      },
      {
        fields: ['delivery_id']
      },
      {
        fields: ['overall_rating']
      },
      {
        fields: ['status']
      },
      {
        fields: ['moderation_status']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['is_verified']
      },
      {
        // Composite index for finding reviews by reviewee and rating
        fields: ['reviewee_id', 'overall_rating', 'status']
      },
      {
        // Unique constraint to prevent duplicate reviews for same delivery
        unique: true,
        fields: ['delivery_id', 'reviewer_id']
      }
    ],
    scopes: {
      active: {
        where: {
          status: 'active',
          moderation_status: 'approved'
        }
      },
      verified: {
        where: {
          is_verified: true
        }
      },
      public: {
        attributes: {
          exclude: ['moderated_by', 'moderated_at', 'moderation_notes']
        }
      }
    },
    hooks: {
      beforeCreate: (review) => {
        // Auto-generate tags based on rating and content
        review.tags = generateReviewTags(review);
        
        // Set metadata
        review.metadata = {
          ...review.metadata,
          submittedAt: new Date().toISOString(),
          ipAddress: review.metadata.ipAddress || null,
          userAgent: review.metadata.userAgent || null
        };
      },
      beforeUpdate: (review) => {
        if (review.changed('moderation_status')) {
          review.moderatedAt = new Date();
        }
      }
    }
  });

  // Instance methods
  Review.prototype.getAverageRating = function() {
    const ratings = [
      this.communicationRating,
      this.punctualityRating,
      this.carefulnessRating,
      this.friendlinessRating
    ].filter(rating => rating !== null && rating !== undefined);
    
    if (ratings.length === 0) return this.overallRating;
    
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    return Math.round((sum / ratings.length) * 100) / 100;
  };

  Review.prototype.getCategoryRatings = function() {
    return {
      communication: this.communicationRating,
      punctuality: this.punctualityRating,
      carefulness: this.carefulnessRating,
      friendliness: this.friendlinessRating
    };
  };

  Review.prototype.getHelpfulnessScore = function() {
    const total = this.helpfulVotes + this.unhelpfulVotes;
    if (total === 0) return 0;
    return (this.helpfulVotes / total) * 100;
  };

  Review.prototype.isPositive = function() {
    return this.overallRating >= 4;
  };

  Review.prototype.isNegative = function() {
    return this.overallRating <= 2;
  };

  Review.prototype.addResponse = function(response) {
    this.response = response;
    this.responseAt = new Date();
    return this;
  };

  Review.prototype.flag = function(moderatorId, reason) {
    this.moderationStatus = 'flagged';
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
    this.moderationNotes = reason;
    return this;
  };

  Review.prototype.approve = function(moderatorId) {
    this.moderationStatus = 'approved';
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
    return this;
  };

  Review.prototype.remove = function(moderatorId, reason) {
    this.moderationStatus = 'removed';
    this.status = 'hidden';
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
    this.moderationNotes = reason;
    return this;
  };

  Review.prototype.getPublicData = function(includePersonalInfo = false) {
    const data = {
      id: this.id,
      overallRating: this.overallRating,
      comment: this.comment,
      categoryRatings: this.getCategoryRatings(),
      isVerified: this.isVerified,
      helpfulVotes: this.helpfulVotes,
      unhelpfulVotes: this.unhelpfulVotes,
      response: this.response,
      responseAt: this.responseAt,
      tags: this.tags,
      createdAt: this.createdAt
    };

    if (includePersonalInfo && !this.isAnonymous) {
      data.reviewer = {
        id: this.reviewerId,
        // Additional reviewer info would be included via associations
      };
    }

    return data;
  };

  // Class methods
  Review.findByRevieweeId = function(revieweeId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      rating = null,
      verified = null,
      includeHidden = false
    } = options;

    const where = { revieweeId };
    
    if (rating) {
      where.overallRating = rating;
    }
    
    if (verified !== null) {
      where.isVerified = verified;
    }
    
    if (!includeHidden) {
      where.status = 'active';
      where.moderationStatus = 'approved';
    }

    return this.findAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'Reviewer',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  Review.findByReviewerId = function(reviewerId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    return this.findAll({
      where: { reviewerId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'Reviewee',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  Review.getAverageRatingForUser = function(userId) {
    return this.findAll({
      where: {
        revieweeId: userId,
        status: 'active',
        moderationStatus: 'approved'
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('overall_rating')), 'averageRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });
  };

  Review.getRatingBreakdown = function(userId) {
    return this.findAll({
      where: {
        revieweeId: userId,
        status: 'active',
        moderationStatus: 'approved'
      },
      attributes: [
        'overall_rating',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['overall_rating'],
      order: [['overall_rating', 'DESC']],
      raw: true
    });
  };

  Review.findPendingModeration = function(limit = 50) {
    return this.findAll({
      where: {
        moderationStatus: 'pending'
      },
      limit,
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: sequelize.models.User,
          as: 'Reviewer',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: sequelize.models.User,
          as: 'Reviewee',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
  };

  Review.getReviewStats = function(userId = null) {
    const where = userId ? { revieweeId: userId } : {};
    where.status = 'active';
    where.moderationStatus = 'approved';

    return this.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
        [sequelize.fn('AVG', sequelize.col('overall_rating')), 'averageRating'],
        [sequelize.fn('AVG', sequelize.col('communication_rating')), 'avgCommunication'],
        [sequelize.fn('AVG', sequelize.col('punctuality_rating')), 'avgPunctuality'],
        [sequelize.fn('AVG', sequelize.col('carefulness_rating')), 'avgCarefulness'],
        [sequelize.fn('AVG', sequelize.col('friendliness_rating')), 'avgFriendliness']
      ],
      raw: true
    });
  };

  // Associations
  Review.associate = function(models) {
    Review.belongsTo(models.User, {
      foreignKey: 'reviewer_id',
      as: 'Reviewer'
    });

    Review.belongsTo(models.User, {
      foreignKey: 'reviewee_id',
      as: 'Reviewee'
    });

    Review.belongsTo(models.User, {
      foreignKey: 'moderated_by',
      as: 'Moderator'
    });
  };

  return Review;
};

// Helper function to generate tags based on review content
function generateReviewTags(review) {
  const tags = [];
  
  // Rating-based tags
  if (review.overallRating >= 5) tags.push('excellent');
  else if (review.overallRating >= 4) tags.push('good');
  else if (review.overallRating >= 3) tags.push('average');
  else if (review.overallRating >= 2) tags.push('poor');
  else tags.push('terrible');
  
  // Category-based tags
  if (review.communicationRating >= 4) tags.push('good-communication');
  if (review.punctualityRating >= 4) tags.push('punctual');
  if (review.carefulnessRating >= 4) tags.push('careful');
  if (review.friendlinessRating >= 4) tags.push('friendly');
  
  // Content-based tags (simple keyword matching)
  if (review.comment) {
    const comment = review.comment.toLowerCase();
    
    if (comment.includes('fast') || comment.includes('quick')) tags.push('fast');
    if (comment.includes('slow') || comment.includes('late')) tags.push('slow');
    if (comment.includes('professional')) tags.push('professional');
    if (comment.includes('recommend')) tags.push('recommended');
    if (comment.includes('safe') || comment.includes('secure')) tags.push('safe');
    if (comment.includes('damage') || comment.includes('broken')) tags.push('damage-reported');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}