-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE item_category_enum AS ENUM (
    'documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'
);

CREATE TYPE delivery_request_status_enum AS ENUM (
    'pending', 'matched', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'
);

CREATE TYPE urgency_level_enum AS ENUM ('standard', 'express', 'urgent');

CREATE TYPE offer_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired', 'withdrawn');

CREATE TYPE delivery_status_enum AS ENUM (
    'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 
    'delivery_scheduled', 'delivered', 'cancelled', 'disputed'
);

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE delivery_db TO delivery_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO delivery_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO delivery_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO delivery_user;