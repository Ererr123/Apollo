const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const authorizeWorldOwner = require("../middleware/authorizeWorldOwner");
// Two routers because documents are addressed two ways in the API:
//   - nested under a world for create/list (you need the worldId to create one)
//   - standalone by their own id for read/update/delete (matches the README's
//     GET/PATCH/DELETE /documents/:id endpoints)
const nested = express.Router({ mergeParams: true });
const standalone = express.Router();

const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  docType: z.enum(["chapter", "lore", "character_bio", "note"]).optional(),
  orderIndex: z.number().int().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  docType: z.enum(["chapter", "lore", "character_bio", "note"]).optional(),
  orderIndex: z.number().int().optional(),
});

const getDocumentSchema = z.object({
  id: z.string().uuid(),
});

// Middleware to authorize access to a document based on the user and the world it belongs to
async function authorizeDocumentAccess(req, res, next) {
  const { id } = req.params;
  const document = await prisma.document.findUnique({
    where: { id },
    include: { world: true },
  });
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }
  if (!req.user || req.user.id !== document.world.userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

// Post /worlds/:worldId/documents - Create a new document in a world
nested.post("/", authorizeWorldOwner, async (req, res) => {
  const parsedBody = createDocumentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.errors });
  }
  const document = await prisma.document.create({
    data: {
      worldId: req.world.id,
      title: parsedBody.data.title,
      content: parsedBody.data.content,
      docType: parsedBody.data.docType,
      orderIndex: parsedBody.data.orderIndex,
    }
  });
  res.status(201).json(document);
});

// GET /worlds/:worldId/documents - List all documents in a world
nested.get("/", authorizeWorldOwner, async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { worldId: req.world.id },
    orderBy: { orderIndex: "asc" },
  });
  res.json(documents);
});

// GET /documents/:id - Get a document by ID
standalone.get("/:id", authorizeDocumentAccess, async (req, res) => {
  res.json(req.document);
});

// PATCH /documents/:id - Update a document by ID
standalone.patch("/:id", authorizeDocumentAccess, async (req, res) => {
  const parsedBody = updateDocumentSchema.safeParse(req.body);
    if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.errors });
    }
    const updatedDocument = await prisma.document.update({
        where: { id: req.params.id },
        data: parsedBody.data,
    });
    res.json(updatedDocument);
});

// DELETE /documents/:id - Delete a document by ID
standalone.delete("/:id", authorizeDocumentAccess, async (req, res) => {
  await prisma.document.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

module.exports = {
  nested,
  standalone,
};