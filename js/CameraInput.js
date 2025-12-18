import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const CameraInput = {
    active: false,
    controls: {
        moveLeft: 0,
        moveRight: 0,
        accelerate: false,
        brake: false
    },
    video: null,
    gestureRecognizer: null,
    runningMode: "VIDEO",
    lastVideoTime: -1,
    sensitivity: 2.5, // Multiplier for steering angle (high for responsive big turns)
    deadzone: 0.5, // Minimum angle (radians) before steering activates (~29 degrees)
    smoothing: 0.35, // Smoothing factor (higher = silkier transitions)
    _smoothedLeft: 0, // Internal: smoothed left value
    _smoothedRight: 0, // Internal: smoothed right value

    init: async function () {
        console.log("Initializing CameraInput...");

        // 1. Create container for camera preview and debug overlay
        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "200px";
        container.style.height = "150px";
        container.style.zIndex = "10000";
        document.body.appendChild(container);

        // 2. Create video element
        const video = document.createElement("video");
        video.id = "webcam";
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.transform = "scaleX(-1)"; // Mirror effect
        video.style.opacity = "0.7";
        container.appendChild(video);
        this.video = video;

        // 3. Create canvas overlay for drawing debug info
        const canvas = document.createElement("canvas");
        canvas.id = "debug-canvas";
        canvas.width = 200;
        canvas.height = 150;
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.transform = "scaleX(-1)"; // Mirror to match video
        container.appendChild(canvas);
        this.debugCanvas = canvas;
        this.debugCtx = canvas.getContext("2d");

        // 2. Load MediaPipe GestureRecognizer
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
                runningMode: this.runningMode,
                numHands: 2
            });
            console.log("MediaPipe GestureRecognizer loaded.");

            this.startCamera();
        } catch (e) {
            console.error("Failed to load MediaPipe:", e);
        }
    },

    startCamera: async function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("Browser API navigator.mediaDevices.getUserMedia not available");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.addEventListener("loadeddata", () => {
                this.active = true;
                this.predictWebcam();
            });
        } catch (e) {
            console.error("Error accessing webcam:", e);
        }
    },

    predictWebcam: async function () {
        if (!this.active) return;

        // Loop
        requestAnimationFrame(() => this.predictWebcam());

        if (this.video.currentTime === this.lastVideoTime) return;
        this.lastVideoTime = this.video.currentTime;

        const results = this.gestureRecognizer.recognizeForVideo(this.video, Date.now());

        if (results.landmarks && results.landmarks.length > 0) {
            this.processLandmarks(results.landmarks, results.handedness);
        } else {
            // Reset controls if no hands detected
            this.controls.moveLeft = 0;
            this.controls.moveRight = 0;
            this.controls.accelerate = false;
            this.controls.brake = false;
        }
    },

    processLandmarks: function (landmarksList, handednessList) {
        // We need at least two hands for the steering logic ideally, 
        // but we can extract what we can.
        // Landmarks: 0: Wrist, ...
        // We will try to find Left and Right wrists to calculate angle.

        let leftWrist = null;
        let rightWrist = null;
        // Check handedness to identify hands if possible, 
        // OR just assume left-most on screen (x coord) is left hand if we have 2.

        // MediaPipe handedness is often accurate but let's be robust.
        // Coordinates are normalized [0,1]. X increases to right.
        // We mirrored the video in CSS, but the coordinates from MediaPipe:
        // If we didn't set mirror in options, x=0 is left of image.

        // Let's iterate all hands
        for (let i = 0; i < landmarksList.length; i++) {
            const landmarks = landmarksList[i];

            // Safety check for handedness
            let name = "Right"; // Default to Right if unknown, or maybe we should rely on screen position
            if (handednessList && handednessList[i] && handednessList[i].length > 0) {
                name = handednessList[i][0].categoryName;
            } else {
                // Fallback: If no handedness info, guess based on X position? 
                // For now, let's just skip if we really can't tell, OR default to Right if it's the only hand?
                // Let's implement a simple heuristic: X < 0.5 is "Left" side of screen -> Mirror -> User's Right Hand.
                // Note: landmarks[0].x is normalized [0,1].
                const wristX = landmarks[0].x;
                // If mirrored (transform scaleX(-1)), then visual left is x < 0.5?
                // MediaPipe output coordinates are usually NOT mirrored by the CSS transform.
                // In raw stream: User Right Hand is on Left side (x < 0.5).
                // User Left Hand is on Right side (x > 0.5).
                // So: if x < 0.5 -> "Right" hand. if x > 0.5 -> "Left" hand.
                if (wristX < 0.5) name = "Right";
                else name = "Left";
            }

            // Calculate palm center by averaging wrist (0) and finger base points (5, 9, 13, 17)
            // This is more stable than using wrist alone
            const palmCenter = {
                x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5,
                y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5
            };

            if (name === "Left") leftWrist = palmCenter;
            if (name === "Right") rightWrist = palmCenter;

            // Identify gestures for throttle/brake on Right Hand
            if (name === "Right") {
                this.processRightHandGesture(landmarks);
            }
        }

        // Phantom Steering
        if (leftWrist && rightWrist) {
            // Debug visualization disabled
            // this.drawDebugLine(leftWrist, rightWrist);

            // Calculate angle based on the line connecting two palm centers
            const dx = rightWrist.x - leftWrist.x;
            const dy = rightWrist.y - leftWrist.y; // y is inverted (0 at top)
            // atan2(dy, dx)
            // If horizontal: dy = 0 -> angle = 0.
            // If Left hand lower (larger y) than Right hand (smaller y) -> dy < 0.
            // Wait: Right Y (small) - Left Y (large) = negative.
            // So dy is negative.
            // atan2(negative, positive) -> negative angle.
            // So Turn Left => Angle < 0?

            // Let's re-read the user spec:
            // angle = atan2(rightWrist.y - leftWrist.y, rightWrist.x - leftWrist.x)
            // 左转: angle > 0.1 (左手低右手高). 
            // Wait user says: "Left hand low (large Y), Right hand high (small Y)".
            // Then rightWrist.y - leftWrist.y should be NEGATIVE.
            // So angle should be negative.
            // BUT User requirement says: "angle > 0.1 (Left hand Low, Right hand High)".
            // This implies the coordinate system user assumes might be Y-up or they mixed it up.
            // OR maybe they mean "Left Hand Low on the wheel" which actually means...
            // Standard Left Turn: 
            //           ^
            //          / \
            //         /   \
            //       (L)   (R)
            // 
            // Turn Left: 
            //       (R)
            //      /
            //     /
            //   (L)
            // Left hand goes DOWN (Higher Y value in Computer Graphics), Right hand goes UP (Lower Y value).
            // dy = Ry - Ly = (Low Value) - (High Value) = NEGATIVE.
            // So Angle should be negative.
            // 
            // If user says "Left Turn: angle > 0.1", maybe they calculated `leftWrist.y - rightWrist.y`?
            // "angle = atan2(rightWrist.y - leftWrist.y, ...)"
            // Let's stick to the User's FORMULA, but correct the Logic interpretation if needed, 
            // OR follow the instruction blindly if it's strict.
            // 
            // Instruction:
            // "angle = atan2(rightWrist.y - leftWrist.y, rightWrist.x - leftWrist.x)"
            // "左转: angle > 0.1 (左手低右手高)"
            // If Left(y=10, x=0), Right(y=0, x=10). dy = -10, dx = 10. atan2(-1, 1) = -0.78.
            // This contradicts "angle > 0.1".
            // 
            // Maybe User means "Left hand LOW (small Y)"? No, pixel coord Y=0 is top.
            // 
            // I will implement the FORMULA and then apply the LOGIC that makes SENSE for a steering wheel, 
            // while trying to respect the mapping.
            // Actually, I will follow the "Left Turn" text intent rather than the sign of 0.1 if they conflict.
            // "Left Turn": Left hand goes down, Right hand goes up.
            // Dy = Ry - Ly < 0.
            // So Angle < 0 is Left Turn.
            // 
            // Let's implement robustly:
            // Calculate angle.
            // If angle is negative (Ry < Ly, R is higher), it's a LEFT turn (steering wheel rotated CCW).
            // User said: "Left Turn: angle > 0.1". I suspect they might be thinking Y-up.
            // 
            // I will invert the sign in my code to match the User's "Left = Positive" request if I can, OR
            // I will just implement the physics:
            // Angle = atan2(Ry - Ly, Rx - Lx).
            // Val = -Angle (so Left turn becomes positive).
            // 
            // Let's blindly follow the USER's CODE logic request if specific code blocks were requested,
            // but here it is a description.
            // "左转: angle > 0.1 (左手低右手高)" -> This is physically contradictory in HTML Canvas coords.
            // But I will assume the goal is "Steer Left".
            // I will use: `let angle = Math.atan2(rightWrist.y - leftWrist.y, rightWrist.x - leftWrist.x);`
            // If I stick strictly to: `angle > 0.1` -> Move Left.
            // Then I must ensure that when I turn left, angle > 0.1.
            // For that to happen, Ry - Ly must be positive. Ry > Ly.
            // Right Hand Y > Left Hand Y. Right hand is "Lower" (visually lower on screen).
            // This corresponds to Turning RIGHT.
            // 
            // Okay, I will implement it such that:
            // Steer Value = calculated from angle.
            // If the user wants "Left Turn" when "Angle > 0.1", I'll do that.
            // But I will add a comment.
            // 
            // Actually, let's look at the second condition:
            // "Right turn: angle < -0.1 (右手低左手高)"
            // Validating: Right Hand Low (Large Y), Left Hand High (Small Y).
            // Ry - Ly = Large - Small = Positive.
            // atan2(Positive) = Positive.
            // So "Right Turn" corresponds to Positive Angle in normal math.
            // User says "Right Turn: angle < -0.1".
            // 
            // The user's conditions seem completely inverted for screen coordinates.
            // Maybe they assume camera mirror makes X inverted but Y is same?
            // If I look at the logic, I'll just map the MAGNITUDE of the angle to the steering.
            // 
            // Real steering logic:
            // angle = atan2(Ry - Ly, Rx - Lx).
            // If Angle < -0.1 (Negative, Ry < Ly, Right Hand High) -> Turn LEFT.
            // If Angle > 0.1 (Positive, Ry > Ly, Right Hand Low) -> Turn RIGHT.
            // 
            // SIMPLIFIED LOGIC: Use Y coordinate difference directly
            // Positive diff = Right hand is lower = Turn Right
            // Negative diff = Left hand is lower = Turn Left
            const yDiff = rightWrist.y - leftWrist.y; // Range roughly -0.5 to 0.5

            // Deadzone and scaling parameters
            const deadzone = 0.05; // 5% of screen height difference needed to start turning
            const maxDiff = 0.32;   // 32% difference = full turn

            let rawLeft = 0;
            let rawRight = 0;

            if (yDiff < -deadzone) {
                // Left hand is lower (Left Turn)
                rawLeft = Math.min(1.0, (Math.abs(yDiff) - deadzone) / (maxDiff - deadzone));
            } else if (yDiff > deadzone) {
                // Right hand is lower (Right Turn)
                rawRight = Math.min(1.0, (yDiff - deadzone) / (maxDiff - deadzone));
            } else {
                // IN DEADZONE: Force zero immediately for clean straight driving
                this._smoothedLeft = 0;
                this._smoothedRight = 0;
                this.controls.moveLeft = 0;
                this.controls.moveRight = 0;
                return; // Skip the rest
            }

            // Apply low-pass filter for smooth steering (reduces jitter)
            this._smoothedLeft = this._smoothedLeft + (rawLeft - this._smoothedLeft) * (1 - this.smoothing);
            this._smoothedRight = this._smoothedRight + (rawRight - this._smoothedRight) * (1 - this.smoothing);

            this.controls.moveLeft = this._smoothedLeft;
            this.controls.moveRight = this._smoothedRight;
        }
    },

    processRightHandGesture: function (landmarks) {
        // Accelerate: Pinch (Thumb Tip 4 and Index Tip 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

        // Thresholds (loosened for better recognition)
        if (distance < 0.08) {
            // Pinch detected - Accelerate
            this.controls.accelerate = true;
            this.controls.brake = false;
        } else if (distance > 0.15) {
            // Palm Open - Brake
            this.controls.accelerate = false;
            this.controls.brake = true;
        } else {
            // Neutral zone - keep previous state for stability
            // (or set to false for explicit neutral)
            this.controls.accelerate = false;
            this.controls.brake = false;
        }
    },

    drawDebugLine: function (leftPos, rightPos) {
        if (!this.debugCtx) return;

        const ctx = this.debugCtx;
        const w = this.debugCanvas.width;
        const h = this.debugCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Convert normalized coords to canvas coords
        const lx = leftPos.x * w;
        const ly = leftPos.y * h;
        const rx = rightPos.x * w;
        const ry = rightPos.y * h;

        // Draw line between palm centers
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw circles at palm centers
        ctx.beginPath();
        ctx.arc(lx, ly, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#FF0000"; // Left = Red
        ctx.fill();

        ctx.beginPath();
        ctx.arc(rx, ry, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#0000FF"; // Right = Blue
        ctx.fill();

        // Calculate and display Y difference (same as steering logic)
        const yDiff = rightPos.y - leftPos.y;
        const yDiffPercent = (yDiff * 100).toFixed(1);
        ctx.font = "14px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Y差: ${yDiffPercent}%`, 5, 20);

        // Show deadzone indicator (deadzone = 0.05 = 5%)
        const inDeadzone = Math.abs(yDiff) < 0.05;
        ctx.fillStyle = inDeadzone ? "#00FF00" : "#FFFF00";
        ctx.fillText(inDeadzone ? "直行" : (yDiff < 0 ? "←左转" : "→右转"), w / 2 - 20, h - 10);
    }
};

window.CameraInput = CameraInput;
CameraInput.init(); // Auto start
