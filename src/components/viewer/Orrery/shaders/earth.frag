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

  // This special function ensures that the normal map doesn't have mountains lit up if they're behind the body.
  float frac_starExposure = min(dot(dir_worldNormal, dir_star), dot(vWorldNormal, dir_star));

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
  float frac_nightLights = tex_landinfo.g;
  float frac_cloudCover = textureCube(uLandinfoCube, distortCubemapTexture(coord_cubemap, dir_view, -frac_cloudAltitude)).b;

  vec3 color_albedo = mix(uOceanColor, tex_color, frac_land);

  vec3 mat_diffuse = color_albedo * color_starLight;

  float frac_specularPower = 10.0;
  vec3 mat_specular = vec3(0.5) * (1.0 - frac_land) * pow(clamp(dot(dir_starReflection, dir_view), 0.0, 1.0), frac_specularPower);

  //t_landinfo = texture2D(uLandinfo, coordinates, pow(cloud_cover, 1.5) * 1.0).rgb;
  
  vec3 mat_emit = uNightColor * frac_nightLights * clamp(pow(-frac_starExposure, 0.5), 0.0, 1.0);

  // The color under the clouds.
  vec3 mat_color = mat_diffuse + mat_specular + mat_emit;

  // The color of the clouds themselves. The power is to keep them brighter near the terminator.
  vec3 color_cloud = vec3(1.0) * pow(clamp(frac_starExposure, 0.0, 1.0), 0.6);

  float frac_cloudShadow = textureCube(uLandinfoCube, distortCubemapTexture(coord_cubemap, dir_star, frac_cloudAltitude), 1.0).b * 0.5;
  
  // Mix in the shadow color.
  mat_color = mix(mat_color, vec3(0.0), frac_cloudShadow);
  
  mat_color = mix(mat_color, color_cloud, frac_cloudCover);
  
  //color = mix(color, cloud_color, pow(cloudshadow, 0.75));
  
  gl_FragColor = vec4(mat_color, 1.0);
}
