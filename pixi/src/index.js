import * as PIXI from 'pixi.js';

const app = new PIXI.Application({ resizeTo: window });

document.body.appendChild(app.view);

const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', // the attribute name
        [-100, -100, // x, y
            100, -100, // x, y
            100, 100,
            -100, 100], // x, y
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

`precision mediump float;

    varying vec2 vUvs;

    uniform sampler2D uSampler2;

    void main() {

        gl_FragColor = texture2D(uSampler2, vUvs );
    }

`,
{
    uSampler2: PIXI.Texture.from('https://pixijs.com/assets/bg_scene_rotate.jpg'),
});

const quad = new PIXI.Mesh(geometry, shader);

quad.position.set(200, 200);
quad.scale.set(2);

app.stage.addChild(quad);

// const renderTexture = PIXI.RenderTexture.create({ width: app.screen.width, height: app.screen.height });
// const sprite = new PIXI.Sprite(renderTexture);
// app.stage.addChild(sprite);

quad.interactive = true;
quad.on('click', () => {
    const rgba = app.renderer.plugins.extract.pixels(quad);
    let index = (event.offsetX * event.offsetY) * 4;
    console.log(index);
    let r = rgba[index];
    let g = rgba[index + 1];
    let b = rgba[index + 2];
    let a = rgba[index + 3];
    console.log(`RGBA: (${r}, ${g}, ${b}, ${a})`);
});

app.ticker.add((delta) =>
{
    // quad.rotation += 0.01;
});
