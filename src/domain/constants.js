// ── Virtual coordinate space ───────────────────────────────────────────────
export const VIRTUAL_W    = 600;
export const VIRTUAL_H    = 400;

// ── Game tuning ────────────────────────────────────────────────────────────
export const INITIAL_SPEED   = 16;
export const TARGET_FRAME_MS = 1000 / 30;
export const MAX_FRAME_MS    = 50;
export const INITIAL_LIVES   = 5;

// ── Ball ───────────────────────────────────────────────────────────────────
export const BALL_SIZE        = 10;
export const SPIN_FACTOR      = 0.25;
export const RALLY_INCREMENT  = 0.5;
export const RALLY_CAP        = 6;
export const READY_PAUSE_MS   = 600;
export const READY_SPEED_FRAC = 0.5;  // fraction of gameSpeed used during serve

// ── Paddle ─────────────────────────────────────────────────────────────────
export const PADDLE_X        = VIRTUAL_W - 15;
export const PADDLE_BASE_H   = 60;
export const PADDLE_W        = 10;
export const PADDLE_ACCEL    = 0.18;
export const PADDLE_DECEL    = 0.28;

// ── Paddle stun ────────────────────────────────────────────────────────────
export const STUN_DURATION_MS        = 2500;
export const STUN_PULSE_ANGULAR_FREQ = 0.019;
export const STUN_PASSTHROUGH_ALPHA  = 0.4;

// ── Power-ups ──────────────────────────────────────────────────────────────
export const POWERUP_LIFESPAN_MS    = 10_000;
export const POWERUP_GRACE_MS       = 2_000;
export const POWERUP_WARN_AT_MS     = 7_000;
export const POWERUP_ORB_RADIUS     = 10;
export const POWERUP_ROAM_RIGHT     = 280;
export const POWERUP_SINGLE_CHANCE  = 0.15;
export const WIDE_DURATION_MS       = 8_000;
export const WIDE_SCALE             = 1.75;

// ── Ghosts ─────────────────────────────────────────────────────────────────
export const GHOST_SIZE             = 32;
export const GHOST_COUNT            = 4;
export const GHOST_ROAM_RATIO       = 0.45;
export const GHOST_CHARGE_PROB      = 0.001;
export const GHOST_CHARGE_SPEED     = 1.6;
export const GHOST_RETREAT_SPEED    = 1.4;
export const GHOST_H_SPEED_RATIO    = 0.7;

// ── Aliens (bonus round) ───────────────────────────────────────────────────
export const ALIEN_COLS      = 3;
export const ALIEN_ROWS      = 6;
export const ALIEN_W         = 28;
export const ALIEN_H         = 22;
export const ALIEN_H_GAP     = 16;
export const ALIEN_V_GAP     = 10;
export const ALIEN_SPAWN_X   = 20;
export const ALIEN_HP        = 2;
export const ALIEN_VERT_SPEED = 1.5;
export const ALIEN_ADVANCE_X  = 0.06;
export const ALIEN_FORM_H    = ALIEN_ROWS * ALIEN_H + (ALIEN_ROWS - 1) * ALIEN_V_GAP;

// ── Mothership (bonus round) ────────────────────────────────────────────────
export const MOTHERSHIP_W             = 52;
export const MOTHERSHIP_H             = 20;
export const MOTHERSHIP_HP            = 5;
export const MOTHERSHIP_APPEAR_OFFSET = 50;   // alienOffsetX threshold before spawn
export const MOTHERSHIP_ROAM_MARGIN   = 6;    // px gap left of formation left edge
export const MOTHERSHIP_ENTRY_SPEED   = 2.5;  // vx sliding in from left edge
export const MOTHERSHIP_ROAM_SPEED    = 1.0;  // vy magnitude while roaming / retreating
export const MOTHERSHIP_CHARGE_SPEED  = 3.0;  // vx/vy during diagonal charge
export const MOTHERSHIP_RETREAT_SPEED = 1.8;  // vx during retreat
export const MOTHERSHIP_CHARGE_FRAC   = 2 / 3; // charge target: fieldW * this
export const MOTHERSHIP_FIRE_MS       = 3500; // laser interval while roaming
export const MOTHERSHIP_RAPID_FIRE_MS = 800;  // laser interval while charging
export const MOTHERSHIP_KILL_SCORE    = 5000;

export const LASER_W          = 8;
export const LASER_H          = 3;
export const LASER_SPEED_MULT = 2.0; // laser speed = gameSpeed * this

// ── Scoring ────────────────────────────────────────────────────────────────
export const BONUS_COMPLETION_SCORE = 2000;
export const LEVEL_CLEAR_SCORE_MULT = 1000;
export const ALIEN_KILL_BASE        = 50;
