precision highp float;

uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform vec3 uNightColor;

uniform vec3 uStarPosition;
uniform vec3 uStarColor;

uniform vec4 uAtmosphereParameters;
uniform vec4 uAtmosphereRaleighScatter;

uniform sampler2D uAtmosphereThickness;

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

varying vec3 vAtmosphereColor;

const float PI = 3.141592653;
const float PI_2 = 6.28318530;

#import "./include.glsl";
#import "./atmosphere.glsl";

void main() {
  vec3 dir_view = getDirectionView();
  vec3 dir_star = getDirectionStar();

  // Cubemap uses model-space normal direction.
  vec3 coord_cubemap = vNormal;

  // The computed normal from the cubemap.
  vec3 dir_worldNormal = modelToWorldDirection(normalFromCubemap(uNormalCube, coord_cubemap));

  /*
  float blend = smoothstep(-0.001, 0.001, vScreenPosition.x);

  gl_FragColor = vec4(mix(dir_worldNormal * 0.5 + 0.5, vWorldNormal * 0.5 + 0.5, blend), 1.0);

  return;
*/

  // This special function ensures that the normal map doesn't have mountains lit up if they're behind the body.
  float frac_starExposure = min(dot(dir_worldNormal, dir_star), pow(clamp(dot(vWorldNormal, dir_star), 0.0, 1.0), 0.75));

  // The dark side of the planet will be this bright, as a fraction of full brightness.
  float frac_brightnessBoost = 0.1;

  // This includes the color as well.
  vec3 color_starLight = (clamp(frac_starExposure, 0.0, 1.0) * (1.0 - frac_brightnessBoost) + frac_brightnessBoost) * uStarColor;

  float frac_cloudAltitude = 0.005;

  // The direction of the sun reflecting off the world. We use the (spherical) normal here, not the normalmap.
  vec3 dir_starReflection = reflect(dir_star, vWorldNormal);

  vec3 tex_landinfo = textureCube(uLandinfoCube, coord_cubemap).rgb;
  vec3 tex_color = textureCube(uColorCube, coord_cubemap).rgb;

  float frac_land = tex_landinfo.r;
  float frac_nightLights = tex_landinfo.b;
  float frac_cloudCover = textureCube(uLandinfoCube, distortCubemapTexture(coord_cubemap, dir_view, -frac_cloudAltitude)).g;

  vec3 color_albedo = tex_color;

  // The diffuse component of this pixel.
  vec3 mat_diffuse = color_albedo * color_starLight;

  float frac_specularPower = 10.0;
  vec3 mat_specular = vec3(0.5) * (1.0 - frac_land) * pow(clamp(dot(dir_starReflection, dir_view), 0.0, 1.0), frac_specularPower);

  //t_landinfo = texture2D(uLandinfo, coordinates, pow(cloud_cover, 1.5) * 1.0).rgb;

  vec3 mat_emit = uNightColor * frac_nightLights * clamp(pow(-frac_starExposure, 0.5), 0.0, 1.0);

  // The color under the clouds.
  vec3 mat_color = mat_diffuse + mat_specular + mat_emit;

  // The color of the clouds themselves. The power is to keep them brighter near the terminator.
  vec3 color_cloud = vec3(1.0) * (pow(clamp(frac_starExposure, 0.0, 1.0), 0.6) * (1.0 - frac_brightnessBoost) + frac_brightnessBoost);

  float frac_cloudShadow = textureCube(uLandinfoCube, distortCubemapTexture(coord_cubemap, dir_star, frac_cloudAltitude), 1.0).g * 0.5;

  // Mix in the shadow color.
  mat_color = mix(mat_color, vec3(0.0), frac_cloudShadow);

  // And finally, mix in the clouds on top.
  mat_color = mix(mat_color, color_cloud, frac_cloudCover);

  vec3 mat_atmosphere = vAtmosphereColor;

  gl_FragColor = vec4(mat_atmosphere + mat_color, 1.0);
}
