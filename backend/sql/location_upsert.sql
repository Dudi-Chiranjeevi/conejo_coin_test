ALTER TABLE inventory_location
ADD CONSTRAINT uniq_client_type_name_parent
UNIQUE (client_id, type, name, parent_id);

-- assume you have pgcrypto enabled
INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('3a5c9ae0-0c7b-4a1a-9f4e-0a2f8a9b1a10', 'Site A', 'site', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', NULL, NULL, 'Site A'),
('7d2f1c3e-5b6a-4df0-9a3b-2e5f6a7b8c90', 'Site B', 'site', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', NULL, NULL, 'Site B');

INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('9b6c1f2a-3d4e-4b5c-8a9b-1c2d3e4f5a60', 'Room A1', 'room', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '3a5c9ae0-0c7b-4a1a-9f4e-0a2f8a9b1a10', NULL, 'Site A > Room A1'),
('1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a50', 'Room A2', 'room', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '3a5c9ae0-0c7b-4a1a-9f4e-0a2f8a9b1a10', NULL, 'Site A > Room A2'),
('0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a40', 'Room B1', 'room', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '7d2f1c3e-5b6a-4df0-9a3b-2e5f6a7b8c90', NULL, 'Site B > Room B1');

INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('a1b2c3d4-5e6f-4071-8a9b-0c1d2e3f4b61', 'Shelf 1', 'shelf', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '9b6c1f2a-3d4e-4b5c-8a9b-1c2d3e4f5a60', NULL, 'Site A > Room A1 > Shelf 1'),
('b2c3d4e5-6f70-4182-9a0b-1c2d3e4f5b62', 'Shelf 2', 'shelf', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '9b6c1f2a-3d4e-4b5c-8a9b-1c2d3e4f5a60', NULL, 'Site A > Room A1 > Shelf 2'),
('c3d4e5f6-7081-4293-a0b1-2c3d4e5f6b63', 'Shelf 1', 'shelf', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a50', NULL, 'Site A > Room A2 > Shelf 1'),
('d4e5f6a7-8192-43a4-b0c1-3d4e5f6a7b64', 'Shelf 1', 'shelf', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', '0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a40', NULL, 'Site B > Room B1 > Shelf 1');

INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('e5f6a7b8-92a3-44b5-c0d1-4e5f6a7b8c65', 'Row 1', 'row', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'a1b2c3d4-5e6f-4071-8a9b-0c1d2e3f4b61', NULL, 'Site A > Room A1 > Shelf 1 > Row 1'),
('f6a7b8c9-a3b4-45c6-d0e1-5f6a7b8c9d66', 'Row 2', 'row', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'a1b2c3d4-5e6f-4071-8a9b-0c1d2e3f4b61', NULL, 'Site A > Room A1 > Shelf 1 > Row 2'),
('a7b8c9d0-b4c5-46d7-e0f1-6a7b8c9d0e67', 'Row 1', 'row', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'b2c3d4e5-6f70-4182-9a0b-1c2d3e4f5b62', NULL, 'Site A > Room A1 > Shelf 2 > Row 1'),
('b8c9d0e1-c5d6-47e8-f001-7b8c9d0e1f68', 'Row 1', 'row', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'd4e5f6a7-8192-43a4-b0c1-3d4e5f6a7b64', NULL, 'Site B > Room B1 > Shelf 1 > Row 1');

INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('c9d0e1f2-d6e7-48f9-0002-8c9d0e1f2a69', 'Box A', 'box', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'e5f6a7b8-92a3-44b5-c0d1-4e5f6a7b8c65', 50, 'Site A > Room A1 > Shelf 1 > Row 1 > Box A'),
('d0e1f203-e7f8-490a-1003-9d0e1f2a3b70', 'Box B', 'box', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'f6a7b8c9-a3b4-45c6-d0e1-5f6a7b8c9d66', 50, 'Site A > Room A1 > Shelf 1 > Row 2 > Box B'),
('e1f20314-f809-4a1b-2004-ad0e1f2a3b71', 'Box C', 'box', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'a7b8c9d0-b4c5-46d7-e0f1-6a7b8c9d0e67', 50, 'Site A > Room A1 > Shelf 2 > Row 1 > Box C'),
('f2031425-091a-4b2c-3005-bd0e1f2a3b72', 'Box D', 'box', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'b8c9d0e1-c5d6-47e8-f001-7b8c9d0e1f68', 50, 'Site B > Room B1 > Shelf 1 > Row 1 > Box D');

INSERT INTO inventory_location (id, name, type, created_at, updated_at, client_id, parent_id, capacity, path) VALUES
('03142536-1a2b-4c3d-4006-cd0e1f2a3b73', 'Slot 1', 'slot', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'c9d0e1f2-d6e7-48f9-0002-8c9d0e1f2a69', 1, 'Site A > Room A1 > Shelf 1 > Row 1 > Box A > Slot 1'),
('14253647-2b3c-4d5e-5007-dd0e1f2a3b74', 'Slot 2', 'slot', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'c9d0e1f2-d6e7-48f9-0002-8c9d0e1f2a69', 1, 'Site A > Room A1 > Shelf 1 > Row 1 > Box A > Slot 2'),
('25364758-3c4d-5e6f-6008-ed0e1f2a3b75', 'Slot 1', 'slot', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'd0e1f203-e7f8-490a-1003-9d0e1f2a3b70', 1, 'Site A > Room A1 > Shelf 1 > Row 2 > Box B > Slot 1'),
('36475869-4d5e-6071-7009-fd0e1f2a3b76', 'Slot 1', 'slot', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'e1f20314-f809-4a1b-2004-ad0e1f2a3b71', 1, 'Site A > Room A1 > Shelf 2 > Row 1 > Box C > Slot 1'),
('4758697a-5e6f-7182-8010-0d1e2f3a4b77', 'Slot 1', 'slot', now(), now(), 'e9f3a0d4-0b71-4728-b131-ec7bc71e902d', 'f2031425-091a-4b2c-3005-bd0e1f2a3b72', 1, 'Site B > Room B1 > Shelf 1 > Row 1 > Box D > Slot 1');
