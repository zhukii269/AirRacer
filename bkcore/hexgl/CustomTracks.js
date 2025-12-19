/**
 * Custom Track Configurations
 * Supports OBJ format tracks with collision/height map images
 */

var bkcore = bkcore || {};
bkcore.hexgl = bkcore.hexgl || {};

bkcore.hexgl.CustomTracks = {

    // List of available custom tracks
    list: {},

    /**
     * Register a new custom track
     * @param {Object} config Track configuration
     */
    register: function (config) {
        if (!config.id) {
            console.error('[CustomTracks] Track must have an id');
            return;
        }
        this.list[config.id] = {
            id: config.id,
            name: config.name || config.id,
            modelPath: config.modelPath,
            diffuseMap: config.diffuseMap || null,
            collisionMap: config.collisionMap,
            heightMap: config.heightMap,
            mapImage: config.mapImage || null,
            spawnPoint: config.spawnPoint || { x: 0, y: 5, z: 0 },
            spawnRotation: config.spawnRotation || { x: 0, y: 0, z: 0 },
            checkpoints: config.checkpoints || { list: [0, 1, 2], start: 0, last: 2 },
            pixelRatio: config.pixelRatio || (2048.0 / 6000.0),
            scale: config.scale || 1,
            // Collision mesh name in OBJ (if multiple objects)
            collisionMeshName: config.collisionMeshName || null
        };
        console.log('[CustomTracks] Registered track:', config.id);
    },

    /**
     * Get a track by ID
     * @param {string} id Track ID
     * @returns {Object|null} Track configuration
     */
    get: function (id) {
        return this.list[id] || null;
    },

    /**
     * Get list of all track IDs
     * @returns {Array} Array of track IDs
     */
    getList: function () {
        return Object.keys(this.list);
    }
};

// Example: Register a custom track
// This is a template - user should modify for their actual track
/*
bkcore.hexgl.CustomTracks.register({
    id: "my-custom-track",
    name: "My Custom Track",
    modelPath: "assets/my-track.obj",
    diffuseMap: "assets/my-track-diffuse.jpg",
    collisionMap: "assets/my-track-collision.png",
    heightMap: "assets/my-track-height.png",
    mapImage: "assets/my-track-map.png",
    spawnPoint: { x: 0, y: 5, z: 0 },
    spawnRotation: { x: 0, y: Math.PI, z: 0 },
    checkpoints: {
        list: [0, 1, 2],
        start: 0,
        last: 2
    },
    pixelRatio: 2048.0 / 6000.0,
    scale: 1,
    collisionMeshName: "Road"
});
*/
