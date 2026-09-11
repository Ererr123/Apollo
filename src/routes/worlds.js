const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const authorizeWorldOwner = require("../middleware/authorizeWorldOwner");

const router = express.Router();

const createWorldSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateWorldSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

// POST /worlds - create (creator becomes owner)
router.post("/", async (req, res) => {
  const parsed = createWorldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const world = await prisma.world.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ownerId: req.user.id,
    },
  });

  res.status(201).json(world);
});

// GET /worlds - list worlds the user has access to
// V0: that just means "worlds they own" - once Collaborator is added in v1,
// this expands to an OR across ownership and collaborator membership.
router.get("/", async (req, res) => {
  const worlds = await prisma.world.findMany({
    where: { ownerId: req.user.id },
    orderBy: { updatedAt: "desc" },
  });
  res.json(worlds);
});

// GET /worlds/:id - read (requires viewer+, which in V0 means owner)
router.get("/:id", authorizeWorldOwner, async (req, res) => {
  res.json(req.world);
});

// PATCH /worlds/:id - update (requires editor+, which in V0 means owner)
router.patch("/:id", authorizeWorldOwner, async (req, res) => {
  const parsed = updateWorldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const world = await prisma.world.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(world);
});

// DELETE /worlds/:id - delete (requires owner)
router.delete("/:id", authorizeWorldOwner, async (req, res) => {
  await prisma.world.delete({
    where: { id: req.params.id },
  });
  res.status(204).end();
});

module.exports = router;