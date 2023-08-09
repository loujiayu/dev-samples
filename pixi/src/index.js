import * as PIXI from 'pixi.js';
import sample from './real.png';
import adeSample from './index.png';
import { effects } from './effect';

let selectedPixel = [6, 230, 230];

let sharp = 0;
let temperature = 0;
let background = PIXI.Texture.from(sample);
let removeEdge = false;

document.getElementById('blur').addEventListener('input', (event) => {
    sharp = (event.target.value - 50) / 50;
})

document.getElementById('temperature').addEventListener('input', (event) => {
    temperature = (event.target.value - 50) / 50;
})

document.getElementById('unselect').addEventListener('click', (event) => {
    selectedPixel = [-100, -100, -100];
})

document.getElementById('remove').addEventListener('click', (event) => {
    removeEdge = !removeEdge;
    console.log(removeEdge);
})

const radios = document.querySelectorAll('input[type="radio"]');  
radios.forEach(radio => {  
  radio.addEventListener('change', () => {  
    const selectedOption = Array.from(radios)  
      .find(radio => radio.checked).value;  

    background = PIXI.Texture.from(selectedOption);
  });  
});  

function renderImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    canvas.id = 'index-color'
    canvas.style.opacity = 0
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const image = new Image();
    image.src = img;
    image.addEventListener("load", () => {
        ctx.drawImage(image, 0, 0, 600, 600);

        const imageData = ctx.getImageData(0, 0, 600, 600);
        console.log(imageData);
    });
    document.querySelector('#index').appendChild(canvas);
    
    document.querySelector('#index').addEventListener('click', (event) => {
        const imageData = ctx.getImageData(event.offsetX, event.offsetY, 1, 1);
        selectedPixel = [...imageData.data];
        console.log(selectedPixel);
    });
}

function getKernels() {
    return {
        edgeDetect: [
            -1, -1, -1,
            -1,  8, -1,
            -1, -1, -1
        ]
    }
}

function renderMesh() {
    const app = new PIXI.Application({ width: 600, height: 600 });

    document.querySelector('#view').appendChild(app.view);

    const uniforms = {
        uSampler2: PIXI.Texture.from(sample),
        indexSample: PIXI.Texture.from(adeSample),
        indexPixel: selectedPixel,
        sharp: sharp,
        background,
        removeEdge: removeEdge ? 1 : 0,
        temperature,
        neighborsOffset: [-1, 0, 1]
    }

    const uniformGroup = new PIXI.UniformGroup(uniforms);  

    const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', // the attribute name
        [-300, -300, // x, y
            300, -300, // x, y
            300, 300,
            -300, 300], // x, y
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
        uniform float sharp;
        uniform float temperature;
        uniform int neighborsOffset[3];
        uniform int removeEdge;

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

        void main() {
            vec2 resolution = vec2(600.0, 600.0);
            vec2 onePixel = vec2(1.0, 1.0) / resolution;
            
            int edgeSum = 0;

            for (int x = 0; x < 3; x++) {
                for (int y = 0; y < 3; y++) {
                    edgeSum += isMeshEdge(vUvs + onePixel * vec2(neighborsOffset[x], neighborsOffset[y]));
                }
            }

            int hasSelected = indexPixel[0] == -100.0 ? 0 : 1;

            vec4 color = texture2D(uSampler2, vUvs );

            if (edgeSum == 9) {
                color = blur(color, uSampler2, vUvs, sharp);
                color = applyTemperature(color, temperature, 0.0);
                
                gl_FragColor = color;
            } else if (edgeSum == 0) {
                if (hasSelected == 0) {
                    gl_FragColor = texture2D(uSampler2, vUvs );
                } else {
                    gl_FragColor = texture2D(background, vUvs );
                }
            }
            else {
                float floatEdgeSum = float(edgeSum);
                if (floatEdgeSum > 4.5) {
                    floatEdgeSum = floatEdgeSum - 4.5;
                }
                if (removeEdge == 1) {
                    gl_FragColor = color;
                } else {
                    gl_FragColor = vec4(0.0, 1.0, 0.0, floatEdgeSum / 4.5 );
                }
            }
        }

        `,
        uniformGroup
        );

    const quad = new PIXI.Mesh(geometry, shader);
    // const indexQuad = new PIXI.Mesh(geometry, indexShader);

    quad.position.set(300, 300);

    app.stage.addChild(quad);

    app.ticker.add((delta) =>
    {
        quad.shader.uniforms.indexPixel = selectedPixel;
        quad.shader.uniforms.sharp = sharp;
        quad.shader.uniforms.temperature = temperature;
        quad.shader.uniforms.background = background;
        quad.shader.uniforms.removeEdge = removeEdge ? 1 : 0;
    });

}

renderMesh()
renderImage(adeSample)