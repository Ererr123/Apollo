Apollo

A mini/basic collabrative writing application. Basically, a lesser Google Docs(for now) - users can create documents, invite collaborators with different roles, and edit shared content.

This is mostly to better learn about CRUD app/aplications and System Design while doing something I like:

Authorization layers: role-based access control (owner / editor / viewer) enforced consistently across every route
Relational modeling: many-to-many relationships between users and documents via a join table
Concurrency handling: starting with last-write-wins, evolving toward optimistic locking
Revision history: append-only history with restore functionality
API design: RESTful resource modeling with nested sub-resources (collaborators, revisions)

Tech stack (for now)
Layer	        Choice	                            Why
Runtime	        Node.js + Express	                Minimal ceremony, easy middleware for auth checks
Database	    PostgreSQL	                        Fit for users/documents/collaborators/revisions
ORM	            Prisma	                            Type-safe queries, migrations, schema as documentation
Auth	        JWT + bcrypt	                    Simple, stateless, sufficient for a learning project
Testing         client	Postman / curl / Thunder    Client	Keeps focus on backend design, not UI

Data model
User
---- id
---- email
---- password_hash
---- name
---- created_at

Document
----id
---- title
---- content
---- owner_id      -> User
---- version       (for optimistic locking, added in v2)
----  created_at
---- updated_at

Collaborator (join table: User <-> Document)
---- id
---- document_id  -> Document
---- user_id       -> User
---- role          (owner | editor | viewer)
---- invited_at

Revision
---- id
---- document_id   -> Document
---- content_snapshot
---- edited_by     -> User
---- created_at

API endpoints
Auth
POST   /auth/register
POST   /auth/login
Documents
POST   /documents                              create (creator becomes owner)
GET    /documents                               list docs the user has access to
GET    /documents/:id                            read (requires viewer+)
PATCH  /documents/:id                            update content (requires editor+)
DELETE /documents/:id                            delete (requires owner)
Collaborators
POST   /documents/:id/collaborators              invite a user (requires owner)
GET    /documents/:id/collaborators              list collaborators
PATCH  /documents/:id/collaborators/:userId       change role (requires owner)
DELETE /documents/:id/collaborators/:userId       revoke access (requires owner)
Revisions (v2)
GET    /documents/:id/revisions                  list history
GET    /documents/:id/revisions/:revId            view a specific past version
POST   /documents/:id/revisions/:revId/restore    roll back to that version
Build order (recommended)

Building this in stages:

v0 - Bare CRUD Auth (register/login) + Document create/read/update/delete, no sharing yet. Every document has exactly one owner.
v1 - Collaboration Add the Collaborator model. Build authorization middleware that checks role before allowing read/write/delete. Add invite/revoke endpoints.
v2 - Concurrency safety Add a version field to Document. Reject PATCH requests with a stale version (optimistic locking) instead of silently overwriting.
v3- Revision history Snapshot content on every save. Add endpoints to view and restore past revisions.

Stretch goals
Diff-based revisions instead of full snapshots
Real-time updates (WebSockets)
Operational transforms / CRDTs for true concurrent editing

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
|   -----  documents.js
|   ----- collaborators.js
----- middleware/
|   -----  authenticate.js      verifies JWT
|   ----- authorize.js         checks role against document
-----  prisma/
| -----  schema.prisma
-----  app.js