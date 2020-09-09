precision highp float;

uniform vec3 uColor;
uniform vec3 uStarPosition;

// X = planet radius; Y = atmosphere radius; Z = atmosphere power; W = mie strength
uniform vec4 uAtmosphereParameters;

// R = red scattering; G = green scattering; B = blue scattering; A = mie power
uniform vec4 uAtmosphereRaleighScatter;

uniform mat4 uWorldMatrix;
uniform mat4 uWorldMatrix_i;
uniform mat4 uViewMatrix;
uniform mat4 uViewMatrix_i;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

// Returns a vec3 containing <distance to sphere surface>, <distance from entry (or camera) to exit>, angle-of-incidence
// If the ray does not intersect the sphere, the X value is negative.
vec4 raySphereDistance(vec3 point, vec3 dir, float radius) {
  float radius2 = radius * radius;
  
  float tca = -dot(point, dir);

  float d2 = dot(point, point) - (tca * tca);

  float thc = sqrt(radius2 - d2);

  float shadow = atan(sqrt(d2), thc) / 1.57079;
  
  float start = tca - thc;
  float end = tca + thc;

  if(d2 > (radius2)) {
    return vec4(-1.0, -1.0, shadow, 0.0);
  }

  if(end < 0.0) {
    return vec4(-1.0, -1.0, shadow, 0.0);
  }

  return vec4(start, end - max(start, 0.0), shadow, 0.0);
}

// Altitude is a floating-point value from 0..1 (where 0 is ground and 1 is sky.)
float densityAtAltitude(float altitude) {
  return exp(-clamp(altitude, 0.0, 1.0) * uAtmosphereParameters.z) * (1.0 - altitude);
}

float densityAtPoint(vec3 position) {
  float atmosphere_height = uAtmosphereParameters.y - uAtmosphereParameters.x;
  float altitude = (length(position) - uAtmosphereParameters.x) / atmosphere_height;

  return densityAtAltitude(altitude);
}

const int OPTICAL_DEPTH_STEPS = 5;
float atmosphereOpticalDepth(vec3 position, vec3 direction, float ray_length) {
  vec3 point = position;
  float step_size = ray_length / float(OPTICAL_DEPTH_STEPS - 1);
  float opticalDepth = 0.0;

  for(int i=0; i<OPTICAL_DEPTH_STEPS; i++) {
    point = position + direction * step_size * float(i);
    opticalDepth += densityAtPoint(point) * step_size;
  }

  return opticalDepth;
}

const int SCATTERING_STEPS = 8;

vec3 atmosphereColor(vec3 position, vec3 direction, vec3 star_direction) {
  float planet_radius = uAtmosphereParameters.x;
  float atmosphere_radius = uAtmosphereParameters.y;

  vec4 atmosphere_ray = raySphereDistance(position, direction, atmosphere_radius);

  // The starting point of the ray (i.e. where it intersects with the atmosphere.)
  vec3 ray_start = position - direction * -max(atmosphere_ray.x, 0.0);
  float ray_length = max(atmosphere_ray.y, 0.0);
  
  vec4 planet_ray = raySphereDistance(position, direction, planet_radius);

  if(planet_ray.y > 0.0) {
    ray_length = (planet_ray.x - atmosphere_ray.x) * 0.9;
  }

  // The total atmosphere color at this point.
  vec3 color = vec3(0.0);

  float step_size = ray_length / float(SCATTERING_STEPS);
  
  for(int i=0; i<=SCATTERING_STEPS; i++) {
    // The point in the atmosphere, in model space.
    vec3 point = ray_start + direction * step_size * float(i);

    vec4 star_ray = raySphereDistance(point, star_direction, atmosphere_radius);
    // The distance through the atmosphere to the sun.
    float star_distance = max(star_ray.y, 0.0);

    // Cast a ray against the planet towards the sun.
    planet_ray = raySphereDistance(point, star_direction, planet_radius);

    // How much of the sun is hitting this sample, from 0..1.
    float star_exposure = 1.0;

    // If the planet is in the way, calculate the smooth shadow.
    if(planet_ray.y > 0.0) {
      star_exposure = smoothstep(0.5, 1.0, planet_ray.z);
    }

    // The optical depth (= approximate density) of the atmosphere along the ray towards the star.
    float star_ray_optical_depth = atmosphereOpticalDepth(point, star_direction, star_distance);
    float view_ray_optical_depth = atmosphereOpticalDepth(point, -direction, step_size);

    // Mie scattering. Essentially a power curve when we're between the viewer and the sun.
    float mie = uAtmosphereParameters.w * pow(max(dot(star_direction, direction), 0.0), uAtmosphereRaleighScatter.w);
    
    vec3 transmittance = exp(-(star_ray_optical_depth + view_ray_optical_depth) * uAtmosphereRaleighScatter.rgb) * star_exposure;

    color += densityAtPoint(point) * transmittance * uAtmosphereRaleighScatter.rgb * step_size;
    color += mie * densityAtPoint(point) * transmittance * step_size;
  }

  return color;
}

void main() {
  // The direction of the star, in world space.
  //vec3 star_direction = normalize(vWorldPosition - uStarPosition);
  
  //vec3 camera_position = uViewMatrix_i[3].xyz;
  //vec3 view_direction = normalize(vWorldPosition - camera_position);
  
  vec3 star_direction = normalize((uWorldMatrix_i * vec4(uStarPosition - vWorldPosition, 0.0)).xyz);
  
  vec3 camera_position = (uWorldMatrix_i * vec4(uViewMatrix_i[3].xyz, 1.0)).xyz;
  vec3 view_direction = normalize((uWorldMatrix_i * vec4(vWorldPosition, 1.0)).xyz - camera_position);
  //vec3 view_direction = normalize((uWorldMatrix_i * vec4(vWorldPosition - camera_position, 0.0)).xyz);
  
  gl_FragColor = vec4(atmosphereColor(camera_position, view_direction, star_direction), 1.0);
}
