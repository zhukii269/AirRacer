/**
 * Custom Track: My Track
 * OBJ-based track configuration
 */

var bkcore = bkcore || {};
bkcore.hexgl = bkcore.hexgl || {};
bkcore.hexgl.tracks = bkcore.hexgl.tracks || {};

bkcore.hexgl.tracks.MyTrack = {
    // Track identification
    id: "my-track",
    name: "自定义赛道",

    // Collision and height analysis
    lib: null,
    materials: {},
    analyser: null,
    pixelRatio: 2048.0 / 6000.0,

    // Checkpoints configuration
    checkpoints: {
        list: [0, 1, 2],
        start: 0,
        last: 2
    },

    // Spawn position and rotation
    spawn: {
        x: 0,
        y: 50,
        z: 0
    },
    spawnRotation: {
        x: 0,
        y: Math.PI,
        z: 0
    },

    // Track loading function
    load: function (opts, quality, ship) {
        var self = this;
        this.lib = new bkcore.threejs.Loader(opts);
        this.selectedShip = ship || 'feisar';

        var shipPath = "textures.full/ships/" + this.selectedShip + "/";
        console.log('[MyTrack] Loading track with ship:', this.selectedShip);

        this.lib.load({
            textures: {
                'hex': "textures.full/hud/hex.jpg",
                'spark': "textures.full/particles/spark.png",
                'cloud': "textures.full/particles/cloud.png",
                'ship.feisar.diffuse': shipPath + "diffuse.jpg",
                'ship.feisar.specular': shipPath + "specular.jpg",
                'ship.feisar.normal': shipPath + "normal.jpg",
                'booster.diffuse': "textures.full/ships/feisar/booster/booster.png",
                'booster.sprite': "textures.full/ships/feisar/booster/boostersprite.jpg"
            },
            texturesCube: {
                'skybox.dawnclouds': "textures.full/skybox/dawnclouds/%1.jpg"
            },
            geometries: {
                'bonus.base': "geometries/bonus/base/base.js",
                'booster': "geometries/booster/booster.js",
                'ship.feisar': "geometries/ships/feisar/feisar.js"
            },
            analysers: {
                'track.mytrack.collision': "assets/my-track-collision.png",
                'track.mytrack.height': "assets/my-track-height.png"
            },
            images: {
                'hud.bg': "textures/hud/hud-bg.png",
                'hud.speed': "textures/hud/hud-fg-speed.png",
                'hud.shield': "textures/hud/hud-fg-shield.png"
            },
            sounds: {
                bg: { src: 'audio/bg.ogg', loop: true, usePanner: false },
                crash: { src: 'audio/crash.ogg', loop: false, usePanner: true },
                destroyed: { src: 'audio/destroyed.ogg', loop: false, usePanner: false },
                boost: { src: 'audio/boost.ogg', loop: false, usePanner: true },
                wind: { src: 'audio/wind.ogg', loop: true, usePanner: true }
            }
        });
    },

    buildMaterials: function (quality) {
        // Ship material (uses standard ship textures)
        this.materials.ship = bkcore.Utils.createNormalMaterial({
            diffuse: this.lib.get("textures", "ship.feisar.diffuse"),
            specular: this.lib.get("textures", "ship.feisar.specular"),
            normal: this.lib.get("textures", "ship.feisar.normal"),
            ambient: 0x444444,
            shininess: 42,
            metal: true,
            perPixel: false
        });

        this.materials.booster = new THREE.MeshBasicMaterial({
            map: this.lib.get("textures", "booster.diffuse"),
            transparent: true
        });

        // Track material (simple for now, can add texture later)
        this.materials.track = new THREE.MeshLambertMaterial({
            color: 0x6699cc,
            ambient: 0x444444
        });

        // Get analysers
        this.analyser = this.lib.get("analysers", "track.mytrack.collision");
        this.height = this.lib.get("analysers", "track.mytrack.height");
    },

    buildScenes: function (ctx, quality) {
        var self = this;

        // Create game scene
        var scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xaaaaaa));

        // Directional light
        var sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(1, 1, 1);
        scene.add(sun);

        // Skybox
        var sceneCube = new THREE.Mesh(
            new THREE.CubeGeometry(70000, 70000, 70000),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                envMap: this.lib.get("texturesCube", "skybox.dawnclouds"),
                side: THREE.BackSide
            })
        );
        scene.add(sceneCube);

        // Load OBJ track
        var loader = new THREE.OBJLoader();
        loader.load("assets/my-track.obj", function (object) {
            console.log('[MyTrack] OBJ loaded:', object);

            // Apply material to all meshes
            object.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    child.material = self.materials.track;
                }
            });

            // Scale and position the track
            object.scale.set(10, 10, 10);  // Adjust scale as needed
            object.position.set(0, 0, 0);  // Adjust position as needed

            scene.add(object);
            console.log('[MyTrack] Track added to scene');
        });

        // Create ship
        var ship = new THREE.Mesh(
            this.lib.get("geometries", "ship.feisar"),
            this.materials.ship
        );
        ship.position.set(this.spawn.x, this.spawn.y, this.spawn.z);
        ship.rotation.set(this.spawnRotation.x, this.spawnRotation.y, this.spawnRotation.z);

        // Create booster
        var booster = new THREE.Mesh(
            this.lib.get("geometries", "booster"),
            this.materials.booster
        );
        booster.doubleSided = true;
        ship.add(booster);

        scene.add(ship);

        // Particles
        var sparks = new bkcore.threejs.Particles({
            randomness: new THREE.Vector3(0.4, 0.4, 0.4),
            tint: 0xffffff,
            color: 0xffc000,
            color2: 0xff0000,
            texture: this.lib.get("textures", "spark"),
            size: 2,
            life: 60,
            max: 200
        });
        scene.add(sparks.system);

        var clouds = new bkcore.threejs.Particles({
            opacity: 0.8,
            tint: 0xffffff,
            color: 0x666666,
            color2: 0xa4f1ff,
            texture: this.lib.get("textures", "cloud"),
            size: 6,
            blending: THREE.NormalBlending,
            life: 60,
            max: 200
        });
        scene.add(clouds.system);

        // Camera setup
        var camera = new THREE.PerspectiveCamera(70, ctx.width / ctx.height, 1, 60000);

        // Effects
        ctx.components.shipControls = new bkcore.hexgl.ShipControls(ctx);
        ctx.components.shipControls.collisionMap = this.analyser;
        ctx.components.shipControls.collisionPixelRatio = this.pixelRatio;
        ctx.components.shipControls.collisionDetection = true;
        ctx.components.shipControls.heightMap = this.height;

        ctx.components.shipControls.mesh = ship;

        ctx.components.cameraChase = new bkcore.hexgl.CameraChase({
            target: ship,
            camera: camera,
            cameraCube: null,
            lerp: 0.5,
            yoffset: 8,
            zoffset: 10
        });

        var shipEffects = new bkcore.hexgl.ShipEffects({
            scene: scene,
            ship: ship,
            booster: booster,
            boosterLight: null,
            shipControls: ctx.components.shipControls,
            sparks: sparks,
            clouds: clouds
        });

        ctx.manager.add("game", scene, camera, function (delta, renderer) {
            if (ctx.gameplay != null) ctx.gameplay.update(delta);
            shipEffects.update(delta);
            ctx.components.cameraChase.update(delta);
        });
    }
};
