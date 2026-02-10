-- Top-Level Categories

-- Coins
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '2e92c5be-7251-44a6-b9a2-c64d5f09855a',
    'Coins',
    NULL,
    '{
        "fields": ["certNumber", "grade", "year", "mintMark", "denomination", "metalType"]
    }',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Stamps
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    'a5e65b80-6de0-4e3c-8f53-0137582c7858',
    'Stamps',
    NULL,
    '{
        "fields": ["issueDate", "perforation", "condition", "country"]
    }',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Cards
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    'f882657f-243c-4028-a6a1-ec90c96f33f7',
    'Cards',
    NULL,
    '{
        "fields": ["playerName", "cardYear", "brand", "cardNumber", "cardCondition"]
    }',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Bullion (parent category)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '2d7cc8e4-1911-47aa-8a49-588f62eb4ad6',
    'Bullion',
    NULL,
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Gold Bullion (child of Bullion)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    'fba9ef24-0731-4452-8f7f-207fdc69e44b',
    'Gold Bullion',
    '2d7cc8e4-1911-47aa-8a49-588f62eb4ad6',
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Silver Bullion (child of Bullion)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '81b75ac1-bb58-4dc7-913e-b68b923e32df',
    'Silver Bullion',
    '2d7cc8e4-1911-47aa-8a49-588f62eb4ad6',
    '{}',
    'YOUR-CLIENT-ID-HERE',
    now(),
    now()
);

-- Jewelry (parent category)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '3b6e8b77-0e4e-43c2-b1e0-2f26bd9debe6',
    'Jewelry',
    NULL,
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Gold Jewelry (child of Jewelry)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '1f6172d2-5a0e-4b67-a56c-2a3b2a437fd5',
    'Gold Jewelry',
    '3b6e8b77-0e4e-43c2-b1e0-2f26bd9debe6',
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Silver Jewelry (child of Jewelry)
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    'd14dc84b-4692-4c3d-91df-6adf3f7d5e9c',
    'Silver Jewelry',
    '3b6e8b77-0e4e-43c2-b1e0-2f26bd9debe6',
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Diamonds
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    'd3e57d95-92b1-4261-92e1-79d1b01db798',
    'Diamonds',
    NULL,
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

-- Other Collectibles
INSERT INTO category (id, name, parent_id, custom_fields, client_id, created_at, updated_at)
VALUES (
    '0f29a08a-d9c4-43b6-ae5c-009e81e88c1c',
    'Other Collectibles',
    NULL,
    '{}',
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d',
    now(),
    now()
);

----------------------------------------
--Client

INSERT INTO client (id, name, contact_email, created_at, updated_at)
VALUES (
    'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 
    'Coenjo Coins',
    'admin@gmail.com',
    now(),
    now()
);

-------------------------------------------------

--Locations
INSERT INTO inventory_location (
    id, name, type, parent_id, client_id, capacity, path, created_at, updated_at
) VALUES
-- Site
('cfe1d3f4-3e63-4c14-8f8c-70f3e7e31201', 'Main Vault', 'site', NULL, 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', NULL, 'Main Vault', NOW(), NOW()),

-- Room under Site
('e9b2a26b-1f94-4de2-bd4e-3c7d9f6e0a33', 'Room A', 'room', 'cfe1d3f4-3e63-4c14-8f8c-70f3e7e31201', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', NULL, 'Main Vault > Room A', NOW(), NOW()),

-- Shelf under Room
('c5d00fce-bb58-44d5-99d1-eac647fa6c17', 'Shelf 1', 'shelf', 'e9b2a26b-1f94-4de2-bd4e-3c7d9f6e0a33', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', NULL, 'Main Vault > Room A > Shelf 1', NOW(), NOW()),

-- Box 1A under Shelf 1
('ea4e6a88-e69d-4f09-a7e4-57a22fd6a8b5', '1A', 'box', 'c5d00fce-bb58-44d5-99d1-eac647fa6c17', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 50, 'Main Vault > Room A > Shelf 1 > 1A', NOW(), NOW()),

-- Box 2B under Shelf 1
('68e5ab91-4f1e-49db-8aef-e74b40300c1b', '2B', 'box', 'c5d00fce-bb58-44d5-99d1-eac647fa6c17', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 50, 'Main Vault > Room A > Shelf 1 > 2B', NOW(), NOW()),

-- Row under Box 1A
('402f6d8b-8aa9-4c16-a63d-e8b26cce1d29', 'Row 1', 'row', 'ea4e6a88-e69d-4f09-a7e4-57a22fd6a8b5', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 10, 'Main Vault > Room A > Shelf 1 > 1A > Row 1', NOW(), NOW()),

-- Row under Box 2B
('b33a2cfd-93c0-4aa5-bad4-05f0ce49139f', 'Row 2', 'row', '68e5ab91-4f1e-49db-8aef-e74b40300c1b', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 10, 'Main Vault > Room A > Shelf 1 > 2B > Row 2', NOW(), NOW()),

-- Slot 1 under Row 1 (Box 1A)
('f78821a5-f3b4-4564-b5fd-34a1a7e11861', 'Slot 1', 'slot', '402f6d8b-8aa9-4c16-a63d-e8b26cce1d29', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 1, 'Main Vault > Room A > Shelf 1 > 1A > Row 1 > Slot 1', NOW(), NOW()),

-- Slot 2 under Row 1 (Box 1A)
('c8a441e7-f92a-4871-891e-4c8c2cfdd6dc', 'Slot 2', 'slot', '402f6d8b-8aa9-4c16-a63d-e8b26cce1d29', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 1, 'Main Vault > Room A > Shelf 1 > 1A > Row 1 > Slot 2', NOW(), NOW()),

-- Slot 1 under Row 2 (Box 2B)
('6cc8e5b5-7cd5-4f49-8906-e719fa4f4a3f', 'Slot 1', 'slot', 'b33a2cfd-93c0-4aa5-bad4-05f0ce49139f', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 1, 'Main Vault > Room A > Shelf 1 > 2B > Row 2 > Slot 1', NOW(), NOW()),

-- Slot 2 under Row 2 (Box 2B)
('b989b5c4-6833-4ef2-8fc0-c3d6930f712a', 'Slot 2', 'slot', 'b33a2cfd-93c0-4aa5-bad4-05f0ce49139f', 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 1, 'Main Vault > Room A > Shelf 1 > 2B > Row 2 > Slot 2', NOW(), NOW());

