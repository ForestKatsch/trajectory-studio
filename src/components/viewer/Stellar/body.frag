precision mediump float;

uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform vec3 uNightColor;
uniform vec3 uStarPosition;

uniform sampler2D uTexture;

uniform mat4 uViewMatrix_i;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewNormal;

const float PI = 3.141592653;
const float PI_2 = 6.28318530;

float smoothstep_inv(float y) {
  if(y<=0.0)return 0.0;
  if(y>=1.0)return 1.0;
  return 0.5-sin(asin(1.0-2.0*y)/3.0);
}

void main() {
  vec3 camera_position = uViewMatrix_i[3].xyz;
  vec3 view_direction = normalize(vWorldPosition - camera_position);
  vec3 star_direction = normalize(uStarPosition - vWorldPosition);
  
  float star_exposure = dot(vWorldNormal, star_direction);
  float star_brightness = pow(clamp(star_exposure, 0.0, 1.0), 1.0);
  star_brightness = star_brightness * 0.95 + 0.05;

  float len = sqrt(pow(vPosition.x, 2.0) + pow(vPosition.z, 2.0));

  vec2 coordinates = vec2(
                          (atan(vPosition.x, vPosition.z)) / PI_2 + 0.5,
                          atan(len, vPosition.y) / PI);

  vec3 landinfo = texture2D(uTexture, coordinates, -5.0).rgb;

  vec3 color = mix(uOceanColor, uLandColor, landinfo.r);


  vec3 diffuse = color * star_brightness;

  vec3 reflection_direction = reflect(star_direction, vWorldNormal);

  vec3 specular = color * pow(clamp(dot(reflection_direction, view_direction), 0.0, 1.0), 5.0) * (1.0 - landinfo.r);

  vec3 night = uNightColor * landinfo.g * clamp(pow(-star_exposure, 0.5), 0.0, 1.0);
  
  gl_FragColor = vec4(diffuse + specular + night, 1.0);
}
