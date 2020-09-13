precision highp float;

uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform vec3 uNightColor;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform samplerCube uLandinfoCube;
uniform samplerCube uNormalCube;
uniform samplerCube uColorCube;

uniform mat4 uViewMatrix_i;
uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;

varying vec3 vPosition;
varying vec3 vScreenPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewNormal;

const float PI = 3.141592653;
const float PI_2 = 6.28318530;

#import "./include.glsl";

void main() {
  vec3 dir_view = getDirectionView();
  vec3 dir_star = getDirectionStar();

  // Cubemap uses model-space normal direction.
  vec3 coord_cubemap = vNormal;

  // The computed normal from the cubemap.
  vec3 dir_worldNormal = modelToWorldDirection(normalFromCubemap(uNormalCube, coord_cubemap));

  dir_worldNormal = normalize(mix(vWorldNormal, dir_worldNormal, 0.3));

  // This special function ensures that the normal map doesn't have mountains lit up if they're behind the body.
  float frac_starExposure = min(dot(dir_worldNormal, dir_star), pow(clamp(dot(vWorldNormal, dir_star), 0.0, 1.0), 0.75));

  // The dark side of the planet will be this bright, as a fraction of full brightness.
  float frac_brightnessBoost = 0.15;

  // This includes the color as well.
  vec3 color_starLight = (clamp(frac_starExposure, 0.0, 1.0) * (1.0 - frac_brightnessBoost) + frac_brightnessBoost) * uStarColor;

  float frac_cloudAltitude = 0.005;

  // The direction of the sun reflecting off the world. We use the (spherical) normal here, not the normalmap.
  vec3 dir_starReflection = reflect(dir_star, dir_worldNormal);

  vec3 tex_color = textureCube(uColorCube, coord_cubemap).rgb;

  vec3 color_albedo = tex_color;

  // The diffuse component of this pixel.
  vec3 mat_diffuse = color_albedo * color_starLight;

  float frac_specularPower = 2.0;
  vec3 mat_specular = color_albedo * pow(clamp(dot(dir_starReflection, dir_view), 0.0, 1.0), frac_specularPower) * 0.1;

  //t_landinfo = texture2D(uLandinfo, coordinates, pow(cloud_cover, 1.5) * 1.0).rgb;

  gl_FragColor = vec4(mat_specular + mat_diffuse, 1.0);
}
