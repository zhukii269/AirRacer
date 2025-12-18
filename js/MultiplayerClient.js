/**
 * AirRacer Multiplayer Client
 * WebSocket client for LAN-based 2-player racing
 */

const MultiplayerClient = {
    socket: null,
    connected: false,
    roomCode: null,
    playerId: null,
    isHost: false,
    opponentState: null,

    // Callbacks
    onRoomCreated: null,
    onRoomJoined: null,
    onOpponentJoined: null,
    onCountdownStart: null,
    onRaceStart: null,
    onOpponentState: null,
    onOpponentFinished: null,
    onRaceResult: null,
    onOpponentDisconnected: null,
    onError: null,

    /**
     * Connect to multiplayer server
     * @param {string} serverUrl - WebSocket server URL (e.g., ws://192.168.1.100:3001)
     */
    connect: function (serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(serverUrl);

                this.socket.onopen = () => {
                    console.log('[MP] Connected to server');
                    this.connected = true;
                    resolve();
                };

                this.socket.onclose = () => {
                    console.log('[MP] Disconnected from server');
                    this.connected = false;
                };

                this.socket.onerror = (err) => {
                    console.error('[MP] Connection error:', err);
                    reject(new Error('无法连接到服务器'));
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Disconnect from server
     */
    disconnect: function () {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.connected = false;
        this.roomCode = null;
        this.playerId = null;
    },

    /**
     * Create a new room (host)
     */
    createRoom: function () {
        if (!this.connected) return;
        this.isHost = true;
        this.socket.send(JSON.stringify({ type: 'create_room' }));
    },

    /**
     * Join an existing room
     * @param {string} roomCode - 6-digit room code
     */
    joinRoom: function (roomCode) {
        if (!this.connected) return;
        this.isHost = false;
        this.socket.send(JSON.stringify({
            type: 'join_room',
            roomCode: roomCode
        }));
    },

    /**
     * Signal that player is ready
     */
    ready: function () {
        if (!this.connected) return;
        this.socket.send(JSON.stringify({ type: 'ready' }));
    },

    /**
     * Send current ship state to server
     */
    sendState: function (position, quaternion, speed) {
        if (!this.connected || !this.socket) return;

        this.socket.send(JSON.stringify({
            type: 'state',
            position: { x: position.x, y: position.y, z: position.z },
            quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
            speed: speed
        }));
    },

    /**
     * Signal race finished
     */
    sendFinish: function (time) {
        if (!this.connected) return;
        this.socket.send(JSON.stringify({
            type: 'finish',
            time: time
        }));
    },

    /**
     * Handle incoming messages
     */
    handleMessage: function (msg) {
        console.log('[MP] Received:', msg.type);

        switch (msg.type) {
            case 'room_created':
                this.roomCode = msg.roomCode;
                this.playerId = msg.playerId;
                if (this.onRoomCreated) this.onRoomCreated(msg.roomCode);
                break;

            case 'room_joined':
                this.roomCode = msg.roomCode;
                this.playerId = msg.playerId;
                if (this.onRoomJoined) this.onRoomJoined(msg.roomCode);
                break;

            case 'opponent_joined':
                if (this.onOpponentJoined) this.onOpponentJoined();
                break;

            case 'countdown_start':
                if (this.onCountdownStart) this.onCountdownStart();
                break;

            case 'race_start':
                if (this.onRaceStart) this.onRaceStart(msg.startTime);
                break;

            case 'opponent_state':
                this.opponentState = {
                    position: msg.position,
                    quaternion: msg.quaternion,
                    speed: msg.speed
                };
                if (this.onOpponentState) this.onOpponentState(this.opponentState);
                break;

            case 'opponent_finished':
                if (this.onOpponentFinished) this.onOpponentFinished(msg.time);
                break;

            case 'race_result':
                if (this.onRaceResult) this.onRaceResult(msg);
                break;

            case 'opponent_disconnected':
                if (this.onOpponentDisconnected) this.onOpponentDisconnected();
                break;

            case 'error':
                console.error('[MP] Server error:', msg.message);
                if (this.onError) this.onError(msg.message);
                break;
        }
    },

    /**
     * Get server URL from current page location
     */
    getDefaultServerUrl: function () {
        const host = window.location.hostname || 'localhost';
        return `ws://${host}:3001`;
    }
};

window.MultiplayerClient = MultiplayerClient;
