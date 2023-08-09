export const effects = `
vec4 applyBrightness(vec4 color, float brightness, float contrast){
  color.rgb += brightness;
  if (contrast > 0.0) {
  color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
  } else {
  color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
  }
  return color;
}

vec4 applyHun(vec4 color , float hun, float saturation){
  float angle = hun * 3.14159265;
  float s = sin(angle), c = cos(angle);
  vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
  float len = length(color.rgb);
  color.rgb = vec3(
  dot(color.rgb, weights.xyz),
  dot(color.rgb, weights.zxy),
  dot(color.rgb, weights.yzx)
  );

  float average = (color.r + color.g + color.b) / 3.0;
  if (saturation > 0.0) {
  color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));
  } else {
  color.rgb += (average - color.rgb) * (-saturation);
  }
  return color;
}

float random(vec3 scale, float seed) {
  return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
}

vec4 applyTemperature(vec4 color, float temperature, float tint) {
  float temp = (temperature + 1.0) * 50.0;
  temp = 0.006 * (temp - 50.0);

  float y = color.b * 0.114 + color.g * 0.587 + color.r * 0.299;
  float i = -color.b * 0.322 - color.g * 0.274 + color.r * 0.596;
  float q = min(max(color.b * 0.311 - color.g * 0.523 + color.r * 0.212 + tint * 0.5226, -0.5226), 0.5226);

  float r = y * 1.0 + i * 0.956 + q * 0.621;
  float g = y * 1.0 - i * 0.272 - q * 0.647;
  float b = y * 1.0 - i * 1.105 + q * 1.702;

  vec3 rgb = vec3(r, g, b);

  vec3 processed = vec3(
      r < 0.5 ? r * 1.86 : (1.0 - 0.14 * (1.0 - r)),
      g < 0.5 ? g * 1.08 : (1.0 - 0.92 * (1.0 - g)),
      b < 0.5 ? 0.0 : (1.0 - 2.0 * (1.0 - b))
  );

  vec3 result = min(max(rgb * (1.0 - temp) + processed * temp, 0.0), 1.0);

  return vec4(result.xyz, 1.0);
}

vec4 blur(vec4 color, sampler2D backgroudTexture, vec2 texCoord, float sharp){
  vec4 blurColor = vec4(0.0);
  float total = 0.0;
  float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
  float radio = 0.01;
  for (float t = -30.0; t <= 30.0; t++) {
    float percent = (t + offset - 0.5) / 30.0;
    float weight = 1.0 - abs(percent);
    vec4 sample1 = texture2D(backgroudTexture, texCoord + radio * percent);
    sample1.rgb *= sample1.a;
    blurColor += sample1 * weight;
    total += weight;
  }
  
  blurColor = blurColor / total;
      blurColor.rgb /= blurColor.a + 0.00001;
  return min(max(mix(blurColor, color, 1.0 + sharp), 0.0), 1.0);
}
`