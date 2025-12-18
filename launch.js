// AirRacer Launch Script
// Single player and Multiplayer mode support

(function () {
  var $ = function (_) {
    return document.getElementById(_);
  };

  // Game settings
  var settings = {
    quality: 3,
    hud: 1,
    godmode: 0
  };

  // Global game reference
  var hexGL = null;
  var isMultiplayer = false;
  var gameLoaded = false;

  // Initialize game (single or multiplayer)
  function init(multiplayer) {
    isMultiplayer = multiplayer;
    gameLoaded = false;

    hexGL = new bkcore.hexgl.HexGL({
      document: document,
      width: window.innerWidth,
      height: window.innerHeight,
      container: $('main'),
      overlay: $('overlay'),
      gameover: $('step-5'),
      quality: settings.quality,
      difficulty: 0,
      hud: settings.hud === 1,
      controlType: 0,
      godmode: settings.godmode,
      track: 'Cityscape',
      multiplayer: multiplayer
    });
    window.hexGL = hexGL;

    var progressbar = $('progressbar');
    hexGL.load({
      onLoad: function () {
        console.log('LOADED.');
        hexGL.init();
        gameLoaded = true;
        $('step-3').style.display = 'none';
        $('step-4').style.display = 'block';

        if (multiplayer) {
          // Create opponent ship for multiplayer
          hexGL.createOpponentShip();
          // Setup multiplayer callbacks
          setupMultiplayerCallbacks();
          // Start the game (render loop) - gameplay.start() will be called when countdown starts
          hexGL.start();
          // Signal ready to server (game is loaded)
          console.log('[MP] Game loaded, sending ready to server');
          window.MultiplayerClient.ready();
        } else {
          hexGL.start();
        }
      },
      onError: function (s) {
        console.error("Error loading " + s + ".");
      },
      onProgress: function (p, t, n) {
        console.log("LOADED " + t + " : " + n + " ( " + p.loaded + " / " + p.total + " ).");
        progressbar.style.width = "" + (p.loaded / p.total * 100) + "%";
      }
    });
  }

  // Setup multiplayer event callbacks (called after game is loaded)
  function setupMultiplayerCallbacks() {
    var mp = window.MultiplayerClient;

    mp.onCountdownStart = function () {
      console.log('[MP] Countdown starting');
      if (hexGL && hexGL.gameplay) {
        hexGL.gameplay.start();
      }
    };

    mp.onRaceStart = function (startTime) {
      console.log('[MP] Race started at', startTime);
    };

    mp.onOpponentFinished = function (time) {
      console.log('[MP] Opponent finished in', time, 'ms');
      if (hexGL && hexGL.hud) {
        hexGL.hud.display("对手已完成!", 2);
      }
    };

    mp.onRaceResult = function (result) {
      console.log('[MP] Race result:', result);
      if (hexGL) {
        hexGL.displayMultiplayerResult(result);
      }
    };

    mp.onOpponentDisconnected = function () {
      console.log('[MP] Opponent disconnected');
      if (hexGL && hexGL.hud) {
        hexGL.hud.display("对手断开连接", 3);
      }
    };
  }

  // Menu settings handlers
  var menuSettings = [
    ['quality', ['低', '中', '高', '超高'], 3, '画质: '],
    ['hud', ['关', '开'], 1, 'HUD: '],
    ['godmode', ['关', '开'], 0, '上帝模式: ']
  ];

  menuSettings.forEach(function (item) {
    var key = item[0];
    var options = item[1];
    var defaultVal = item[2];
    var label = item[3];

    settings[key] = defaultVal;
    var elem = $("s-" + key);
    if (!elem) return;

    elem.innerHTML = label + options[settings[key]];
    elem.onclick = function () {
      settings[key] = (settings[key] + 1) % options.length;
      elem.innerHTML = label + options[settings[key]];
    };
  });

  // Check WebGL support
  function hasWebGL() {
    var gl = null;
    var canvas = document.createElement('canvas');
    try {
      gl = canvas.getContext("webgl");
    } catch (_error) { }
    if (gl == null) {
      try {
        gl = canvas.getContext("experimental-webgl");
      } catch (_error) { }
    }
    return gl != null;
  }

  if (!hasWebGL()) {
    $('start').innerHTML = 'WebGL不支持!';
    $('start').onclick = function () {
      window.location.href = 'http://get.webgl.org/';
    };
    return;
  }

  // === Single Player Mode ===
  $('start').onclick = function () {
    $('step-1').style.display = 'none';
    $('step-2').style.display = 'block';
    $('step-2').style.backgroundImage = "url(css/help-gesture.png)";
  };

  $('step-2').onclick = function () {
    $('step-2').style.display = 'none';
    $('step-3').style.display = 'block';
    init(false); // Single player
  };

  $('step-5').onclick = function () {
    window.location.reload();
  };

  // === Multiplayer Mode ===
  $('start-multi').onclick = function () {
    $('step-1').style.display = 'none';
    $('mp-lobby').style.display = 'block';
  };

  $('mp-back').onclick = function () {
    $('mp-lobby').style.display = 'none';
    $('step-1').style.display = 'block';
    $('mp-menu').style.display = 'flex';
    $('mp-waiting').style.display = 'none';
    $('mp-error').style.display = 'none';
    if (window.MultiplayerClient.connected) {
      window.MultiplayerClient.disconnect();
    }
  };

  // Create Room
  $('mp-create').onclick = function () {
    showError('');
    var serverUrl = window.MultiplayerClient.getDefaultServerUrl();
    console.log('[MP] Connecting to', serverUrl);

    window.MultiplayerClient.connect(serverUrl)
      .then(function () {
        window.MultiplayerClient.createRoom();
      })
      .catch(function (err) {
        showError('无法连接到服务器，请确保已运行 node server.js');
      });
  };

  // Join Room
  $('mp-join').onclick = function () {
    var roomCode = $('mp-room-code').value.trim();
    if (roomCode.length !== 6 || !/^\d+$/.test(roomCode)) {
      showError('请输入6位数字房间码');
      return;
    }

    showError('');
    var serverUrl = window.MultiplayerClient.getDefaultServerUrl();

    window.MultiplayerClient.connect(serverUrl)
      .then(function () {
        window.MultiplayerClient.joinRoom(roomCode);
      })
      .catch(function (err) {
        showError('无法连接到服务器');
      });
  };

  // Multiplayer Client Callbacks (before game loads)
  window.MultiplayerClient.onRoomCreated = function (roomCode) {
    console.log('[MP] Room created:', roomCode);
    $('mp-menu').style.display = 'none';
    $('mp-waiting').style.display = 'block';
    $('mp-code').textContent = roomCode;
    $('mp-status').textContent = '等待对手加入...';
  };

  window.MultiplayerClient.onRoomJoined = function (roomCode) {
    console.log('[MP] Joined room:', roomCode);
    $('mp-menu').style.display = 'none';
    $('mp-waiting').style.display = 'block';
    $('mp-code').textContent = roomCode;
    $('mp-status').textContent = '已加入房间，点击准备开始!';
    $('mp-ready').style.display = 'block';
  };

  window.MultiplayerClient.onOpponentJoined = function () {
    console.log('[MP] Opponent joined');
    $('mp-status').textContent = '对手已加入! 点击准备开始';
    $('mp-ready').style.display = 'block';
  };

  // Initial countdown handler (before game loads) - starts loading
  window.MultiplayerClient.onCountdownStart = function () {
    console.log('[MP] Countdown received, but game not loaded yet - this should not happen');
    // This will be overridden by setupMultiplayerCallbacks after game loads
  };

  window.MultiplayerClient.onError = function (message) {
    showError(message);
  };

  // Ready button - starts loading game immediately
  $('mp-ready').onclick = function () {
    $('mp-ready').style.display = 'none';
    $('mp-status').textContent = '正在加载游戏...';

    // Start loading the game immediately when ready is clicked
    $('mp-lobby').style.display = 'none';
    $('step-3').style.display = 'block';
    init(true); // Multiplayer mode - will call ready() after loading
  };

  function showError(message) {
    var errorDiv = $('mp-error');
    if (message) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    } else {
      errorDiv.style.display = 'none';
    }
  }

  // Credits (keep existing)
  if ($('s-credits')) {
    $('s-credits').onclick = function () {
      $('step-1').style.display = 'none';
      $('credits').style.display = 'block';
    };
  }

  if ($('credits')) {
    $('credits').onclick = function () {
      $('step-1').style.display = 'block';
      $('credits').style.display = 'none';
    };
  }

}).call(this);
