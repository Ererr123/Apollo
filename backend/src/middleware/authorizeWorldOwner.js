// Middleware to authorize the owner of a world
const prisma = require("../lib/prisma");

// Middleware to authorize the owner of a world
async function authorizeWorldOwner(req, res, next) {
    const worldId = req.params.worldId || req.params.id;
    const world = await prisma.world.findUnique({wohere: { id: worldId }});

    // Check if the world exists and if the user is the owner
    if (!world) {
        return res.status(404).json({ error: "World not found" });
    }
    // Check if the user is the owner of the world
    if (world.ownerId !== req.user.id) {
        return res.status(403).json({ error: "You are not authorized to access this world" });
    }
    // Attach the world to the request object for further use
    req.world = world;
    next();
}
// Export the middleware function
module.exports = authorizeWorldOwner;