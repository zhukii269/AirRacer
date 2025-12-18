/**
 * Ship Configurations
 * Each ship has unique performance characteristics
 */

var bkcore = bkcore || {};
bkcore.hexgl = bkcore.hexgl || {};

bkcore.hexgl.Ships = {
    // Original ship - balanced performance
    feisar: {
        name: "Feisar",
        displayName: "飞煞",
        description: "均衡型 - 适合新手",
        color: "#4190bb",
        textures: {
            diffuse: "textures.full/ships/feisar/diffuse.jpg",
            specular: "textures.full/ships/feisar/specular.jpg",
            normal: "textures.full/ships/feisar/normal.jpg"
        },
        stats: {
            maxSpeed: 7.0,
            thrust: 0.02,
            angularSpeed: 0.0125,
            airResist: 0.02,
            boosterSpeed: 3.5
        }
    },

    // Shadow - stealth style, high speed but hard to control
    shadow: {
        name: "Shadow",
        displayName: "暗影",
        description: "高速型 - 操控困难",
        color: "#555555",
        textures: {
            diffuse: "textures.full/ships/shadow/diffuse.jpg",
            specular: "textures.full/ships/shadow/specular.jpg",
            normal: "textures.full/ships/shadow/normal.jpg"
        },
        stats: {
            maxSpeed: 8.5,
            thrust: 0.025,
            angularSpeed: 0.010,
            airResist: 0.015,
            boosterSpeed: 4.5
        }
    },

    // Viper - aggressive red, best acceleration
    viper: {
        name: "Viper",
        displayName: "毒蛇",
        description: "加速型 - 起步快",
        color: "#ff4444",
        textures: {
            diffuse: "textures.full/ships/viper/diffuse.jpg",
            specular: "textures.full/ships/viper/specular.jpg",
            normal: "textures.full/ships/viper/normal.jpg"
        },
        stats: {
            maxSpeed: 6.5,
            thrust: 0.035,
            angularSpeed: 0.015,
            airResist: 0.025,
            boosterSpeed: 3.0
        }
    },

    // Phoenix - golden, best handling
    phoenix: {
        name: "Phoenix",
        displayName: "凤凰",
        description: "操控型 - 转向灵活",
        color: "#d4a017",
        textures: {
            diffuse: "textures.full/ships/phoenix/diffuse.jpg",
            specular: "textures.full/ships/phoenix/specular.jpg",
            normal: "textures.full/ships/phoenix/normal.jpg"
        },
        stats: {
            maxSpeed: 6.8,
            thrust: 0.022,
            angularSpeed: 0.018,
            airResist: 0.02,
            boosterSpeed: 3.2
        }
    },

    // Get ship list for menu
    getList: function () {
        return ['feisar', 'shadow', 'viper', 'phoenix'];
    },

    // Get ship by key
    get: function (key) {
        return this[key] || this.feisar;
    }
};
