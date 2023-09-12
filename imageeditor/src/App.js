import { Slider, Stack } from '@fluentui/react';
import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import indexSample from './index.png';
import { effects } from './effect';

import './App.css';

let app;
let ctx;
let selectedIndex = [-100, -100, -100];
let sharps = [0];
let changedIndex = [getColorId(selectedIndex)];

// function cleanup() {
//   selectedIndex = 
//   app = null;
//   ctx = null;
// }

// cleanup();

function getColorId(rgb) {
  return rgb[0] * 256 * 256 + rgb[1] * 256 + rgb[2];
}

function renderMesh(container, image, indexImage, imageWidth, imageHeight) {
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
      uniform float imageWidth;
      uniform float imageHeight;
      
      uniform float changedIndex[10];
      uniform float sharps[10];

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

          for (int i = 1; i < 10; i++) {
            if (abs(colorId - changedIndex[i]) < 2.0) {
                color = blur(color, uSampler2, vUvs, sharps[i]);
              }
          }

          if (edgeSum > 7) {
              gl_FragColor = color;
          } else if (edgeSum < 3) {
              gl_FragColor = color;

              // if (hasSelected == 0) {
              //     gl_FragColor = texture2D(color, vUvs );
              // } else {
              //     gl_FragColor = texture2D(background, vUvs );
              // }
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
  app.stage.addChild(mesh);
  
  app.ticker.add((delta) => {
    mesh.shader.uniforms.indexPixel = selectedIndex;
    mesh.shader.uniforms.sharps = sharps;
    mesh.shader.uniforms.changedIndex = changedIndex;
    // mesh.shader.uniforms.temperature = temperature;
    // mesh.shader.uniforms.background = background;
    // mesh.shader.uniforms.removeEdge = removeEdge ? 1 : 0;
  })
  // return [quad, app];
}

function App(props) {
  const { image } = props;

  const [indexImage, setIndexImage] = useState();
  const [sharpsState, setSharpsState] = useState([50]);
  const [selectedIndexState, setSelectedIndexState] = useState([-100, -100, -100]);
  const myRef = useRef(null);
  const myCanvas = useRef(null);

  const imageWidth = 600;
  const imageHeight = 600;

  // cleanup
  // useEffect(() => {
  //   return () => cleanup();
  // });

  function drawIndexCanvas(indexCanvasImage) {
    ctx = myCanvas.current.getContext("2d", { willReadFrequently: true });

    ctx.drawImage(indexCanvasImage, 0, 0, imageWidth, imageHeight);
  }

  function handleCanvasClick(event) {
    const boundingClientRect = myCanvas.current.getBoundingClientRect();

    const selectedPixel = ctx.getImageData(event.clientX - boundingClientRect.left, event.clientY - boundingClientRect.top, 1, 1);

    if (selectedPixel.data[0] === selectedIndex[0] && selectedPixel.data[1] === selectedIndex[1] && selectedPixel.data[2] === selectedIndex[2]) {
      selectedIndex = [-100, -100, -100];
    } else {
      selectedIndex = [...selectedPixel.data];
    }

    setSelectedIndexState(selectedIndex);
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
      renderMesh(myRef.current, image, indexImage, imageWidth, imageHeight)
    }
  }, [image, indexImage]);

  function getCurrentColorIndex() {
    const currentColorId = getColorId(selectedIndexState);
    return [changedIndex.indexOf(currentColorId), currentColorId];
  }

  const [paramsIndex, i] = getCurrentColorIndex();

  return (
    <div className="App">
      <div style={{ width: 1200, height: 800, padding: 30, display: 'flex' }} >
        <div style={{ flex: 1, textAlign: 'left' }} >
          <div>Replace BackGround</div>
          <div style={{width: 300}}>
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
              <Slider label='temprether'  max={100} min={0}/>
            </Stack>
          </div>
          <div></div>
        </div>
        <div style={{ flex: 3, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
          <div style={{ position: 'absolute' }} ref={myRef} ></div>
          <canvas onClick={handleCanvasClick} ref={myCanvas} style={{ opacity: 0, position: 'absolute' }} width={imageWidth} height={imageHeight} />
        </div>
      </div>
      {/* <div ref={myRef} ></div>
      <canvas width={600} /> */}
    </div>
  );
}

export default App;
