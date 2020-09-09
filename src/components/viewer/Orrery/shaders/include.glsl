
vec3 getViewDirection() {
  vec3 camera_position = uViewMatrix_i[3].xyz;
  return normalize(vWorldPosition - camera_position);
}

vec3 getStarDirection() {
  return normalize(uStarPosition - vWorldPosition);
}
