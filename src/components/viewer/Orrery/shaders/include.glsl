
vec3 getDirectionView() {
  vec3 camera_position = uViewMatrix_i[3].xyz;
  return normalize(vWorldPosition - camera_position);
}

vec3 getDirectionStar() {
  return normalize(uStarPosition - vWorldPosition);
}

vec3 normalFromCubemap(samplerCube sampler, vec3 coordinates) {
  return textureCube(sampler, coordinates).rgb * 2.0 - 1.0;
}

vec3 modelToWorldDirection(vec3 normal) {
  return normalize((uWorldMatrix * vec4(normal, 0.0)).xyz);
}

vec3 worldToModelDirection(vec3 normal) {
  return normalize((uWorldMatrix_i * vec4(normal, 0.0)).xyz);
}

vec3 distortCubemapTexture(vec3 coordinate, vec3 direction, float amount) {
  return normalize(coordinate + normalize(worldToModelDirection(direction)) * amount);
}
