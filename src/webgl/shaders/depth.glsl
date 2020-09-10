
// Given the `gl_Position`, a factor, and the far clip distance, returns
// a new `gl_Position` with a Z range of 0..1 (before multiplication with `w`.)
// The z range -1..0 is reserved for linear-depth meshes.
vec4 depthBufferLogVert(vec4 position, float factor, float camera_far_clip) {
  position.z = log(factor * position.w + 1.0) / log(factor * camera_far_clip + 1.0) * position.w;

  return position;
}
