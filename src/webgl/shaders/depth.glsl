
vec4 depthBufferLogVert(vec4 position, float factor, float camera_far_clip) {
  position.z = (2.0 * log(factor * position.w + 1.0) / log(factor * camera_far_clip + 1.0) - 1.0) * position.w;

  return position;
}
