Apollo

A worldbuilding platform for writers - create a World, then build it out with documents (chapters, lore, character bios), maps, and timelines, all shared with collaborators.

This started as a basic collaborative doc editor and grew into something closer to a lightweight world-bible tool (think: a mini Notion/World Anvil for fiction writers). It's mostly a vehicle for learning CRUD apps and System Design while doing something I like:

Authorization layers: role-based access control (owner / editor / viewer) enforced consistently across every route, across multiple resource types
Relational modeling: many-to-many relationships between users and worlds via a join table, plus optional cross-links between resources (a map pin pointing to a lore document, a timeline event pointing to a chapter)
Concurrency handling: starting with last-write-wins, evolving toward optimistic locking
Revision history: append-only history with restore functionality
API design: RESTful resource modeling with nested sub-resources (collaborators, revisions, maps, timeline events)

Tech stack (for now)
Layer	        Choice	                            Why
Runtime	        Node.js + Express	                Minimal ceremony, easy middleware for auth checks
Database	    PostgreSQL	                        Fit for users/worlds/documents/maps/timelines and their relationships
ORM	            Prisma	                            Type-safe queries, migrations, schema as documentation
Auth	        JWT + bcrypt	                    Simple, stateless, sufficient for a learning project
File storage    S3-compatible (S3 / R2 / MinIO)    For map images - added in v2/v3, not needed for v0
Testing         client	Postman / curl / Thunder    Client	Keeps focus on backend design, not UI

Data model
User
---- id
---- email
---- password_hash
---- name
---- created_at

World                                   (top-level container, replaces old "Document" root)
---- id
---- title
---- description
---- owner_id      -> User
---- created_at
---- updated_at

Collaborator (join table: User <-> World)
---- id
---- world_id      -> World
---- user_id       -> User
---- role          (owner | editor | viewer)
---- invited_at

Document                                (chapters, lore pages, character bios, notes - scoped to a World)
---- id
---- world_id      -> World
---- title
---- content
---- doc_type      (chapter | lore | character_bio | note)
---- order_index
---- version       (for optimistic locking, added in v2)
---- created_at
---- updated_at

Map
---- id
---- world_id      -> World
---- title
---- image_url
---- created_at
---- updated_at

MapPin
---- id
---- map_id        -> Map
---- label
---- description
---- x_coord
---- y_coord
---- linked_document_id  -> Document (nullable)
---- created_at

TimelineEvent
---- id
---- world_id      -> World
---- title
---- description
---- date_label    (flexible string, e.g. "Year 3 of the Third Age" - not a real date)
---- sort_order
---- linked_document_id  -> Document (nullable)
---- created_at

Revision
---- id
---- document_id   -> Document
---- content_snapshot
---- edited_by     -> User
---- created_at

Note: linked_document_id on MapPin and TimelineEvent is a simple nullable foreign key for v0-v3. Whether this should instead be a generic polymorphic link (so a pin or event could point to a Map or Character too, not just a Document) is an open design decision to revisit once Characters exist.

API endpoints
Auth
POST   /auth/register
POST   /auth/login

Worlds
POST   /worlds                                    create (creator becomes owner)
GET    /worlds                                     list worlds the user has access to
GET    /worlds/:id                                  read (requires viewer+)
PATCH  /worlds/:id                                  update (requires editor+)
DELETE /worlds/:id                                  delete (requires owner)

Collaborators
POST   /worlds/:id/collaborators                    invite a user (requires owner)
GET    /worlds/:id/collaborators                    list collaborators
PATCH  /worlds/:id/collaborators/:userId             change role (requires owner)
DELETE /worlds/:id/collaborators/:userId             revoke access (requires owner)

Documents
POST   /worlds/:id/documents                        create (requires editor+)
GET    /worlds/:id/documents                        list documents in world (requires viewer+)
GET    /documents/:id                                read (requires viewer+)
PATCH  /documents/:id                                update content (requires editor+)
DELETE /documents/:id                                delete (requires editor+)

Maps
POST   /worlds/:id/maps                              create (requires editor+)
GET    /worlds/:id/maps                              list maps in world
GET    /maps/:id                                     read
PATCH  /maps/:id                                     update (requires editor+)
DELETE /maps/:id                                     delete (requires editor+)
POST   /maps/:id/pins                                add pin (requires editor+)
GET    /maps/:id/pins                                list pins
PATCH  /pins/:id                                     update pin (requires editor+)
DELETE /pins/:id                                     delete pin (requires editor+)

Timeline
POST   /worlds/:id/timeline-events                   create (requires editor+)
GET    /worlds/:id/timeline-events                   list events, ordered
PATCH  /timeline-events/:id                           update (requires editor+)
DELETE /timeline-events/:id                           delete (requires editor+)

Revisions (v2+)
GET    /documents/:id/revisions                     list history
GET    /documents/:id/revisions/:revId                view a specific past version
POST   /documents/:id/revisions/:revId/restore        roll back to that version

Build order (recommended)

Building this in stages:

v0 - Worlds + Documents. Auth (register/login), World create/read/update/delete, Document CRUD scoped to a world (ordered, typed). Every world has exactly one owner, no sharing yet.
v1 - Collaboration. Add the Collaborator model at the World level. Build authorization middleware that checks role before allowing read/write/delete across any resource type in a world, not just documents.
v2 - Maps. Add Map + MapPin. Decide on the polymorphic-linking question before building pins. Add S3-compatible storage for map images.
v3 - Timeline. Add TimelineEvent, ordered by sort_order (not real dates).
v4 - Concurrency + revisions. Add version field to Document for optimistic locking. Snapshot content on save, add revision view/restore endpoints.

Stretch goals
Diff-based revisions instead of full snapshots
Real-time updates (WebSockets) - e.g. live cursors on a shared document, live pin updates on a map
Operational transforms / CRDTs for true concurrent editing
Character entity, cross-linked from documents/pins/events
Full-text search across all world content

Getting started
bash
# clone and install
npm install

# set up environment
cp .env.example .env
# fill in DATABASE_URL and JWT_SECRET

# run migrations
npx prisma migrate dev

# start the dev server
npm run dev

Project structure
src/
----- routes/
|   ----- auth.js
|   -----  worlds.js
|   ----- documents.js
|   ----- collaborators.js
|   ----- maps.js
|   ----- timelineEvents.js
----- middleware/
|   -----  authenticate.js      verifies JWT
|   ----- authorize.js         checks role against a world, resource-type agnostic
-----  prisma/
| -----  schema.prisma
-----  app.js