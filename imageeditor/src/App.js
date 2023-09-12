import { Slider, Stack, DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';
import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import indexSample from './index.png';
import { effects } from './effect';
import { Collapse } from './collapse';
import './App.css';

let app;
let ctx;
let selectedIndex = [-100, -100, -100];
let sharps = [0];
let temperatures = [0];
let hues = [0];
let saturations = [0];
let brightness = [0];
let changedIndex = [getColorId(selectedIndex)];
let glBackground = null;
let lastUndoPushTime = Date.now();

const defaultIcon = `url(\'https://cdn4.iconfinder.com/data/icons/ionicons/512/icon-ios7-circle-outline-512.png\'),auto`;
const hoverIcon = 'url(\'https://pixijs.com/assets/bunny_saturated.png\'),auto';

console.log(defaultIcon);
console.log(hoverIcon);

function cleanup() {
  app = null;
}

// cleanup();

function getColorId(rgb) {
  return rgb[0] * 256 * 256 + rgb[1] * 256 + rgb[2];
}

function renderMesh(container, image, indexImage, imageWidth, imageHeight, indexCanvas) {
  if (app) {
    return;
  }

  app = new PIXI.Application({ width: imageWidth, height: imageHeight });
  container.appendChild(app.view);

  const uniforms = {
    uSampler2: PIXI.Texture.from(image),
    indexSample: PIXI.Texture.from(indexImage),
    imageHeight,
    imageWidth,
    removeEdge: 0,
    // indexPixel: selectedPixel,
    changedIndex,
    sharps,
    temperatures,
    neighborsOffset: [-1, 0, 1],
  }

  const uniformGroup = new PIXI.UniformGroup(uniforms);  

  const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', // the attribute name
        [-imageWidth / 2, -imageHeight / 2, // x, y
          imageWidth / 2, -imageHeight / 2, // x, y
          imageWidth / 2, imageHeight / 2,
          -imageWidth / 2, imageHeight / 2], // x, y
        2) // the size of the attribute
    .addAttribute('aUvs', // the attribute name
        [0, 0, // u, v
            1, 0, // u, v
            1, 1,
            0, 1], // u, v
        2) // the size of the attribute
    .addIndex([0, 1, 2, 0, 2, 3])
    .interleave();

  const shader = PIXI.Shader.from(`
      precision mediump float;

      attribute vec2 aVertexPosition;
      attribute vec2 aUvs;

      uniform mat3 translationMatrix;
      uniform mat3 projectionMatrix;

      varying vec2 vUvs;

      void main() {

          vUvs = aUvs;
          gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

      }`,

      `
      ${effects}
      precision mediump float;

      varying vec2 vUvs;

      uniform sampler2D uSampler2;
      uniform sampler2D indexSample;
      uniform sampler2D background;

      uniform float indexPixel[3];
      uniform float temperature;
      uniform int neighborsOffset[3];
      uniform int removeEdge;
      uniform int hasBackground;
      uniform float imageWidth;
      uniform float imageHeight;
      
      uniform float changedIndex[10];
      uniform float sharps[10];
      uniform float temperatures[10];
      uniform float hues[10];
      uniform float saturations[10];
      uniform float brightness[10];

      int isEqual(float channel, float selectedChannel) {
          return abs(channel * 256.0 - selectedChannel) < 2.0 ? 1 : 0;
      }

      int isMeshEdge(vec2 texCoord) {
          vec4 indexColor = texture2D(indexSample, texCoord);

          int c1 = isEqual(indexColor.r, indexPixel[0]);
          int c2 = isEqual(indexColor.g, indexPixel[1]);
          int c3 = isEqual(indexColor.b, indexPixel[2]);

          return (c1 + c2 + c3) == 3 ? 1 : 0; 
      }

      float getColorId(vec4 color) {
          return (color.r * 256.0 * 256.0 + color.g * 256.0 + color.b) * 255.0;
      }

      void main() {
          vec2 resolution = vec2(imageWidth, imageHeight);
          vec2 onePixel = vec2(1.0, 1.0) / resolution;
          
          int edgeSum = 0;

          for (int x = 0; x < 3; x++) {
              for (int y = 0; y < 3; y++) {
                  edgeSum += isMeshEdge(vUvs + onePixel * vec2(neighborsOffset[x], neighborsOffset[y]));
              }
          }

          int hasSelected = indexPixel[0] == -100.0 ? 0 : 1;

          vec4 color = texture2D(uSampler2, vUvs );
          vec4 indexColor = texture2D(indexSample, vUvs );
          float colorId = getColorId(indexColor);

          // apply to global
          color = blur(color, uSampler2, vUvs, sharps[0]);
          color = applyTemperature(color, temperatures[0], 0.0);
          color = applyHun(color, hues[0], saturations[0]);
          color = applyBrightness(color, brightness[0], 0.0);

          for (int i = 1; i < 10; i++) {
            if (abs(colorId - changedIndex[i]) < 2.0) {
                color = blur(color, uSampler2, vUvs, sharps[i]);
                color = applyTemperature(color, temperatures[i], 0.0);
                color = applyHun(color, hues[i], saturations[i]);
                color = applyBrightness(color, brightness[i], 0.0);
              }
          }

          if (edgeSum > 7) {
              gl_FragColor = color;
          } else if (edgeSum < 3) {
              if (hasBackground == 0) {
                  gl_FragColor = color;
              } else {
                  gl_FragColor = texture2D(background, vUvs );
              }
          }
          else {
              // float floatEdgeSum = float(edgeSum);
              // if (floatEdgeSum > 4.5) {
              //     floatEdgeSum = floatEdgeSum - 4.5;
              // }
              if (removeEdge == 1) {
                  gl_FragColor = color;
              } else {
                  gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0 );
              }
          }
      }

      `,
      uniformGroup
    );

  const mesh = new PIXI.Mesh(geometry, shader);
  mesh.position.set(imageWidth / 2, imageHeight / 2);

  // app.renderer.events.cursorStyles.default = defaultIcon;
  // app.renderer.events.cursorStyles.hover = hoverIcon;
  app.stage.addChild(mesh);
  app.ticker.add((delta) => {
    mesh.shader.uniforms.indexPixel = selectedIndex;
    mesh.shader.uniforms.sharps = sharps;
    mesh.shader.uniforms.hues = hues;
    mesh.shader.uniforms.brightness = brightness;
    mesh.shader.uniforms.saturations = saturations;
    mesh.shader.uniforms.changedIndex = changedIndex;
    mesh.shader.uniforms.temperatures = temperatures;
    mesh.shader.uniforms.indexSample = new PIXI.BaseTexture(indexCanvas);
    mesh.shader.uniforms.background = glBackground;
    mesh.shader.uniforms.hasBackground = !!glBackground;
    // mesh.shader.uniforms.removeEdge = removeEdge ? 1 : 0;
  })
  return [mesh, app];
}

function App(props) {
  const { image } = props;

  const [isBrushMouseUp, setBrushMouseUp] = useState(false);
  const [indexImage, setIndexImage] = useState();
  const [sharpsState, setSharpsState] = useState([50]);
  const [enableBrush, setEnableBrush] = useState(false);
  const [huesState, setHuesState] = useState([50]);
  const [brightnessState, setBrightnessState] = useState([50]);
  const [temperaturesState, setTemperaturesState] = useState([50]);
  const [saturationsState, setSaturationsState] = useState([50]);
  const [selectedIndexState, setSelectedIndexState] = useState([-100, -100, -100]);
  const [brushSize, setBrushSize] = useState(20);
  const [background, setBackground] = useState();
  const [brushWarning, setBrushWarning] = useState(false);
  const [brushStack, setBrushStack] = useState([]);

  const myRef = useRef(null);
  const myCanvas = useRef(null);

  const imageWidth = 600;
  const imageHeight = 600;

  // cleanup
  useEffect(() => {
    return () => cleanup();
  });

  function drawIndexCanvas(indexCanvasImage) {
    ctx = myCanvas.current.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(indexCanvasImage, 0, 0, imageWidth, imageHeight);
  }

  function getDistance(source, dest) {
    return Math.sqrt(Math.pow(source[0] - dest[0], 2) + Math.pow(source[1] - dest[1], 2))
  }

  function modifyIndexCanvas(path) {
    const offset = brushSize;

    if (selectedIndex[0] === -100) {
      setBrushWarning(true);
      return;
    }
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    const boundingClientRect = myCanvas.current.getBoundingClientRect();

    for (let p = 0; p < path.length; p++) {

      const sx = path[p][0] - boundingClientRect.left;
      const sy = path[p][1] - boundingClientRect.top

      for (let i = -offset / 2; i < offset / 2; i++) {
        for (let j = -offset / 2; j < offset / 2; j++) {
          if (getDistance([sx, sy], [(sx + i), (sy + j)]) > offset / 2) {
            continue;
          }
          const indexNeedToChange = ((sy + j) * imageWidth + (sx + i)) * 4

          imageData.data[indexNeedToChange] = selectedIndex[0]
          imageData.data[indexNeedToChange+1] = selectedIndex[1]
          imageData.data[indexNeedToChange+2] = selectedIndex[2]
        }
      }
    }

    // throttle
    if (Date.now() - lastUndoPushTime > 1000) {
      brushStack.push(imageData);
      setBrushStack([...brushStack]);
      lastUndoPushTime = Date.now();
    }
    ctx.putImageData(imageData, 0,0)
  }

  function handleMouseUp(event) {
    if (enableBrush) {

      setBrushMouseUp(false)
    }
  }

  function handleMouseDown(event) {
    if (enableBrush) {
      setBrushMouseUp(true);
    }
  }

  function handleMouseMove(event) {
    if (enableBrush && isBrushMouseUp) {
      modifyIndexCanvas([[event.clientX, event.clientY]])
    }
  }

  function handleCanvasClick(event) {
    const boundingClientRect = myCanvas.current.getBoundingClientRect();
    const sx = event.clientX - boundingClientRect.left;
    const sy = event.clientY - boundingClientRect.top

    if (enableBrush) {
      modifyIndexCanvas([[event.clientX, event.clientY]])
    } else {
      setBrushWarning(false);
      const selectedPixel = ctx.getImageData(sx, sy, 1, 1);
  
      if (selectedPixel.data[0] === selectedIndex[0] && selectedPixel.data[1] === selectedIndex[1] && selectedPixel.data[2] === selectedIndex[2]) {
        selectedIndex = [-100, -100, -100];
      } else {
        selectedIndex = [...selectedPixel.data];
      }
  
      setSelectedIndexState(selectedIndex);
    }
  }
  
  useEffect(() => {
    setTimeout(() => {
      const imageTag = new Image();
      imageTag.src = indexSample;

      imageTag.onload = () => {
        drawIndexCanvas(imageTag)
        setIndexImage(indexSample);
      }
    }, 1000);
  }, [image])

  useEffect(() => {
    if (indexImage) {
      renderMesh(myRef.current, image, indexImage, imageWidth, imageHeight, myCanvas.current)
    }
  }, [image, indexImage]);

  function getCurrentColorIndex() {
    const currentColorId = getColorId(selectedIndexState);
    return [changedIndex.indexOf(currentColorId), currentColorId];
  }

  const [paramsIndex, i] = getCurrentColorIndex();
  const imgs = [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWcOhU4Ej0qKpZrjffn3KwbyD9quINYnlCrw&usqp=CAU',
    'https://iso.500px.com/wp-content/uploads/2022/07/Sunset-somewhere-in-Iowa-By-Vath.-Sok-2.jpeg'
  ]

  return (
    <div className="App">
      <div style={{ width: 1200, height: 800, padding: 30, display: 'flex' }} >
        <div style={{ textAlign: 'left', flexBasis: 320 }} >
          <Collapse title="Background" itemIcon="BackgroundColor" >
            <div style={{ padding: '16px 0' }} >
              <div style={{ display: 'flex' }} >
                {imgs.map(img => (
                  <div style={{ marginRight: 5, cursor: 'pointer',  }} >
                    <img style={{boxShadow: img === background ? '0 1.6px 3.6px 0 blue, 0 0.3px 0.9px 0 blue' : 'unset'}} src={img} width={100} height={100} alt="" srcset="" onClick={(event) => {
                      if (background === img) {
                        setBackground()
                        glBackground = null;
                      } else {
                        setBackground(img)
                        glBackground = PIXI.Texture.from(img);
                      }
                    }} />
                  </div>
                ))}
                <div style={{
                  width: 100,
                  cursor: 'pointer',
                  height: 100,
                  display: 'flex',
                  position: 'relative',
                  boxShadow: '0 1.6px 3.6px 0 rgba(0,0,0,.132), 0 0.3px 0.9px 0 rgba(0,0,0,.108)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 30
                }} > + <input
                  accept='.png,.jpg,.jpeg'
                style={{
                  opacity: 0,
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                }} type="file" onChange={(event) => {
                  setBackground()
                  glBackground = PIXI.Texture.from(URL.createObjectURL(event.target.files[0]))
                }} /> </div>
              </div>
            </div>
          </Collapse>
          <Collapse styles={{ marginTop: 20 }} title="Color" itemIcon="Color" >
            <div style={{ padding: '16px 0'}}>
              <Stack tokens={{ childrenGap: 20 }}>
                <Slider label="Sharpen" max={100} min={0} value={sharpsState[paramsIndex] || 50} onChange={(value) => {
                  const [index, currentColorId] = getCurrentColorIndex();

                  const normalizedValue = (value - 50) / 50;

                  if (index === -1) {
                    changedIndex.push(currentColorId);
                    sharps.push(normalizedValue);

                    sharpsState.push(value);
                    setSharpsState([...sharpsState]);
                  } else {
                    sharps[index] = normalizedValue;

                    sharpsState[index] = value;
                    setSharpsState([...sharpsState]);
                  }
                }} />
                <Slider label='Temperature'  max={100} min={0} value={temperaturesState[paramsIndex] || 50} onChange={(value) => {
                  const [index, currentColorId] = getCurrentColorIndex();

                  const normalizedValue = (value - 50) / 50;

                  if (index === -1) {
                    changedIndex.push(currentColorId);
                    temperatures.push(normalizedValue);

                    temperaturesState.push(value);
                    setTemperaturesState([...temperaturesState]);
                  } else {
                    temperatures[index] = normalizedValue;

                    temperaturesState[index] = value;
                    setTemperaturesState([...temperaturesState]);
                  }
                }} />

                <Slider label='Hue'  max={100} min={0} value={huesState[paramsIndex] || 50} onChange={(value) => {
                  const [index, currentColorId] = getCurrentColorIndex();

                  const normalizedValue = (value - 50) / 50;

                  if (index === -1) {
                    changedIndex.push(currentColorId);
                    hues.push(normalizedValue);

                    huesState.push(value);
                    setHuesState([...huesState]);
                  } else {
                    hues[index] = normalizedValue;

                    huesState[index] = value;
                    setHuesState([...huesState]);
                  }
                }} />
                
                <Slider label='Saturation'  max={100} min={0} value={saturationsState[paramsIndex] || 50} onChange={(value) => {
                  const [index, currentColorId] = getCurrentColorIndex();

                  const normalizedValue = (value - 50) / 50;

                  if (index === -1) {
                    changedIndex.push(currentColorId);
                    saturations.push(normalizedValue);

                    saturationsState.push(value);
                    setSaturationsState([...saturationsState]);
                  } else {
                    saturations[index] = normalizedValue;

                    saturationsState[index] = value;
                    setSaturationsState([...saturationsState]);
                  }
                }} />
                <Slider label='Brightness'  max={100} min={0} value={brightnessState[paramsIndex] || 50} onChange={(value) => {
                  const [index, currentColorId] = getCurrentColorIndex();

                  const normalizedValue = (value - 50) / 50;

                  if (index === -1) {
                    changedIndex.push(currentColorId);
                    brightness.push(normalizedValue);

                    brightnessState.push(value);
                    setBrightnessState([...brightnessState]);
                  } else {
                    brightness[index] = normalizedValue;

                    brightnessState[index] = value;
                    setBrightnessState([...brightnessState]);
                  }
                }} />
              </Stack>
            </div>

          </Collapse>
          
          <Collapse styles={{ marginTop: 20 }} title="Tool" itemIcon="Toolbox">
            <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px 0' }} >
              <DefaultButton
                iconProps={{ iconName: 'Touch' }}
                style={{ marginRight: 10 }}
                onClick={() => {
                  setEnableBrush(false)
                  myCanvas.current.style.cursor = ''
                }}
                primary={!enableBrush}
              />
              <DefaultButton
                iconProps={{ iconName: 'Brush' }}
                onClick={() => {
                  setEnableBrush(true)
                  myCanvas.current.style.cursor = 'grab'
                }}
                primary={enableBrush}
              />
            </div>
            {enableBrush && <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column' }} >
              <Slider label='Brush Size' min={10} max={100} step={2} value={brushSize} onChange={(value) => setBrushSize(value)} />
              
              <DefaultButton
                text="Undu"
                style={{ marginBottom: 10 }}
                onClick={() => {
                  if (brushStack.length === 0) {
                    const imageTag = new Image();
                    imageTag.src = indexSample;

                    imageTag.onload = () => {
                      drawIndexCanvas(imageTag)
                    }
                  } else {
                    const lastData = brushStack.pop();
                    setBrushStack([...brushStack]);
                    ctx.putImageData(lastData, 0,0)
                  }
                }}
              />
              <DefaultButton
                text="Reset"
                onClick={() => {
                  const imageTag = new Image();
                  imageTag.src = indexSample;

                  imageTag.onload = () => {
                    drawIndexCanvas(imageTag)
                  }
                }}
              />
            </div>}
          </Collapse>
        </div>
        <div style={{ flex: 3, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
          {brushWarning && <div style={{ position: 'absolute', top: 0 }} >
            <MessageBar messageBarType={MessageBarType.warning} isMultiline={false} dismissButtonAriaLabel="Close" >
              Please select one object to use brush
            </MessageBar>
          </div>}
          <div style={{ position: 'absolute' }} ref={myRef} ></div>
          <canvas
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseDown={handleMouseDown}
            ref={myCanvas}
            style={{ opacity: 0, position: 'absolute' }}
            width={imageWidth}
            height={imageHeight}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
