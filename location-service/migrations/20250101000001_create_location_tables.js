exports.up = function(knex) {
  return knex.schema
    // Create ENUM types
    .raw(`
      CREATE TYPE geofence_type_enum AS ENUM ('pickup', 'delivery', 'restricted', 'safe_zone');
      CREATE TYPE geometry_type_enum AS ENUM ('circle', 'polygon');
      CREATE TYPE geofence_event_type_enum AS ENUM ('enter', 'exit', 'dwell');
      CREATE TYPE emergency_type_enum AS ENUM ('accident', 'breakdown', 'theft', 'medical', 'other');
      CREATE TYPE emergency_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
      CREATE TYPE emergency_status_enum AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved');
      CREATE TYPE tracking_status_enum AS ENUM ('active', 'paused', 'stopped', 'completed');
    `)
    
    // Location Tracking Table
    .createTable('location_tracking', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('delivery_id').notNullable().index();
      table.uuid('user_id').notNullable().index();
      table.specificType('coordinates', 'GEOGRAPHY(POINT, 4326)').notNullable();
      table.decimal('accuracy', 8, 2); // meters
      table.decimal('altitude', 10, 2); // meters
      table.decimal('bearing', 6, 2); // degrees
      table.decimal('speed', 8, 2); // km/h
      table.integer('battery_level'); // percentage
      table.string('network_type', 20); // wifi, cellular, offline
      table.timestamp('timestamp').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Indexes for performance
      table.index(['delivery_id', 'timestamp']);
      table.index(['user_id', 'timestamp']);
      table.index(['timestamp']);
    })
    
    // Geofences Table
    .createTable('geofences', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('name', 255).notNullable();
      table.specificType('type', 'geofence_type_enum').notNullable();
      table.uuid('delivery_id').nullable().index();
      
      table.specificType('geometry_type', 'geometry_type_enum').notNullable();
      table.specificType('center_coordinates', 'GEOGRAPHY(POINT, 4326)');
      table.integer('radius'); // meters (for circle)
      table.specificType('polygon_coordinates', 'GEOGRAPHY(POLYGON, 4326)'); // for polygon
      
      table.jsonb('notifications').defaultTo('{}');
      table.boolean('active').defaultTo(true);
      
      table.timestamp('start_time');
      table.timestamp('end_time');
      table.string('timezone', 50).defaultTo('UTC');
      
      table.jsonb('metadata').defaultTo('{}');
      
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes for geospatial queries
      table.index(['delivery_id', 'active']);
      table.index(['type', 'active']);
    })
    
    // Geofence Events Table
    .createTable('geofence_events', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('geofence_id').notNullable().references('id').inTable('geofences').onDelete('CASCADE');
      table.uuid('user_id').notNullable().index();
      table.uuid('delivery_id').nullable().index();
      table.specificType('event_type', 'geofence_event_type_enum').notNullable();
      table.specificType('coordinates', 'GEOGRAPHY(POINT, 4326)');
      table.integer('dwell_time'); // seconds
      table.timestamp('triggered_at').defaultTo(knex.fn.now());
      
      table.index(['geofence_id', 'triggered_at']);
      table.index(['user_id', 'triggered_at']);
      table.index(['delivery_id', 'triggered_at']);
    })
    
    // Route Optimizations Table
    .createTable('route_optimizations', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('delivery_id').nullable().index();
      table.specificType('origin_coordinates', 'GEOGRAPHY(POINT, 4326)').notNullable();
      table.specificType('destination_coordinates', 'GEOGRAPHY(POINT, 4326)').notNullable();
      table.jsonb('waypoints'); // Array of waypoint coordinates
      
      table.jsonb('optimized_route').notNullable(); // Route segments and instructions
      table.decimal('total_distance', 10, 2).notNullable(); // km
      table.integer('total_duration').notNullable(); // minutes
      table.decimal('total_detour', 10, 2).defaultTo(0.00); // km
      
      table.decimal('fuel_cost', 8, 2);
      table.decimal('toll_cost', 8, 2);
      
      table.jsonb('traffic_conditions');
      table.jsonb('alternatives');
      
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at');
      
      table.index(['delivery_id']);
      table.index(['created_at']);
      table.index(['expires_at']);
    })
    
    // Emergency Locations Table
    .createTable('emergency_locations', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('delivery_id').notNullable().index();
      table.uuid('user_id').notNullable().index();
      table.specificType('emergency_type', 'emergency_type_enum').notNullable();
      table.specificType('coordinates', 'GEOGRAPHY(POINT, 4326)').notNullable();
      table.decimal('accuracy', 8, 2);
      
      table.text('description').notNullable();
      table.string('contact_number', 20);
      table.boolean('requires_assistance').defaultTo(false);
      table.specificType('severity', 'emergency_severity_enum').notNullable();
      
      table.specificType('status', 'emergency_status_enum').notNullable().defaultTo('reported');
      table.timestamp('resolved_at');
      table.text('resolution_notes');
      
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['status', 'created_at']);
      table.index(['severity', 'created_at']);
      table.index(['emergency_type']);
    })
    
    // Tracking Sessions Table
    .createTable('tracking_sessions', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('delivery_id').notNullable().unique();
      table.uuid('user_id').notNullable().index();
      table.specificType('status', 'tracking_status_enum').notNullable().defaultTo('active');
      table.jsonb('settings').defaultTo('{}');
      table.jsonb('privacy_settings').defaultTo('{}');
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('stopped_at');
      table.timestamp('last_update_at');
      table.integer('total_updates').defaultTo(0);
      table.decimal('total_distance', 10, 2).defaultTo(0); // km
      table.integer('total_duration').defaultTo(0); // minutes
      
      table.index(['user_id', 'status']);
      table.index(['status', 'started_at']);
    })
    
    // Location Cache Table (for offline sync)
    .createTable('location_cache', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('delivery_id').notNullable().index();
      table.uuid('user_id').notNullable().index();
      table.jsonb('cached_locations').notNullable(); // Array of location objects
      table.string('sync_reason', 50); // network_restored, manual_sync, scheduled
      table.boolean('processed').defaultTo(false);
      table.timestamp('cached_at').defaultTo(knex.fn.now());
      table.timestamp('processed_at');
      
      table.index(['processed', 'cached_at']);
      table.index(['delivery_id', 'processed']);
    })
    
    // Privacy Settings Table
    .createTable('privacy_settings', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').notNullable().unique();
      table.string('tracking_level', 20).defaultTo('precise'); // precise, approximate, minimal
      table.jsonb('share_with').defaultTo('{}');
      table.integer('data_retention_days').defaultTo(90);
      table.boolean('delete_after_delivery').defaultTo(false);
      table.boolean('anonymization_enabled').defaultTo(true);
      table.integer('anonymization_delay_hours').defaultTo(24);
      table.jsonb('notification_preferences').defaultTo('{}');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['user_id']);
    })
    
    // Create PostGIS extension if not exists
    .raw('CREATE EXTENSION IF NOT EXISTS postgis')
    .raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    // Create spatial indexes
    .raw('CREATE INDEX idx_location_tracking_coordinates ON location_tracking USING GIST(coordinates)')
    .raw('CREATE INDEX idx_geofences_center ON geofences USING GIST(center_coordinates)')
    .raw('CREATE INDEX idx_geofences_polygon ON geofences USING GIST(polygon_coordinates)')
    .raw('CREATE INDEX idx_emergency_locations_coordinates ON emergency_locations USING GIST(coordinates)');
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('location_cache')
    .dropTableIfExists('privacy_settings')
    .dropTableIfExists('tracking_sessions')
    .dropTableIfExists('emergency_locations')
    .dropTableIfExists('route_optimizations')
    .dropTableIfExists('geofence_events')
    .dropTableIfExists('geofences')
    .dropTableIfExists('location_tracking')
    .raw(`
      DROP TYPE IF EXISTS tracking_status_enum;
      DROP TYPE IF EXISTS emergency_status_enum;
      DROP TYPE IF EXISTS emergency_severity_enum;
      DROP TYPE IF EXISTS emergency_type_enum;
      DROP TYPE IF EXISTS geofence_event_type_enum;
      DROP TYPE IF EXISTS geometry_type_enum;
      DROP TYPE IF EXISTS geofence_type_enum;
    `);
};