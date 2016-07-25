"use strict"
navigator.getUserMedia = navigator.getUserMedia || navigator["webkitGetUserMedia"] || navigator["mozGetUserMedia"] || navigator["msGetUserMedia"] || navigator["oGetUserMedia"]

class CaptureSession {
  videoElement:any
  canvasElement:any
  canvasContext:any
  stream:any
  videoDevice:any

  readFrame(){
    this.canvasContext.drawImage(this.videoElement, 0, 0, this.videoElement.videoWidth, this.videoElement.videoHeight)
    return this.canvasContext.getImageData(0, 0, this.videoElement.videoWidth, this.videoElement.videoHeight)
  }

  static async create(videoDevice:any){
    return new Promise<CaptureSession>((resolve, reject) => {
      var ret = new CaptureSession()

      ret.videoDevice = videoDevice

      ret.videoElement = document.createElement("video")
      ret.videoElement.autoplay = true

      ret.canvasElement = document.createElement("canvas")

      //FUCK THIS CODE BLOCK
      var videoConstraints:any = {mandatory:{sourceId: videoDevice.deviceId}}
      var stream = navigator.getUserMedia(
        {video: videoConstraints},
        function onSuccess(stream){
          ret.stream = stream
          ret.videoElement["src"] = window.URL.createObjectURL(stream)
          ret.videoElement.addEventListener("play", ()=>{
            ret.canvasElement.width = ret.videoElement.videoWidth
            ret.canvasElement.height = ret.videoElement.videoHeight
            ret.canvasContext = ret.canvasElement.getContext("2d")
            resolve(ret)
          })
        },
        function onError(e){
          reject(e)
        }
      )
    })
  }
}

var DeviceManager = {
  findAllVideoDevices: async()=>{
    var devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d)=>d.kind == "videoinput")
  }
}



var WebGLHelper = {
  loadShader: (gl, type, shaderString)=>{
    var ret = gl.createShader(type)
    gl.shaderSource(ret, shaderString)
    gl.compileShader(ret)
    if (!gl.getShaderParameter(ret, gl.COMPILE_STATUS)) {
        throw ("An error occurred compiling the shaders: " + gl.getShaderInfoLog(ret))
    }
    return ret
  },
  createProgram:(gl, vertShader, fragShader)=>{
    var ret = gl.createProgram()
    gl.attachShader(ret, vertShader)
    gl.attachShader(ret, fragShader)
    gl.linkProgram(ret)
    if (!gl.getProgramParameter(ret, gl.LINK_STATUS)) {
      throw ("Unable to initialize the shader program: " + gl.getProgramInfoLog(ret))
    }
    return ret
  },
  setRectangle: (gl, x, y, width, height) => {
    var x1 = x
    var x2 = x + width
    var y1 = y
    var y2 = y + height
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       x1, y1,
       x2, y1,
       x1, y2,
       x1, y2,
       x2, y1,
       x2, y2]), gl.STATIC_DRAW)
  },
  createTexture: (gl, frame) => {
    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    // Upload the image into the texture.
    if(frame){
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)
    }else{
      //pull texture from current canvas
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.canvas);
    }

    return texture;
  }
}

class GPUImage {
  private device:any
  texture:any

  constructor(device:GPUDevice, texture){
    this.device = device
    this.texture = texture
  }
}



class GPUDevice {
  canvas:any
  private gl:any
  private renderProgram:any

  constructor(){
    this.canvas = document.createElement('canvas');

    //this.setRenderSize(500,500)
    this.gl = this.canvas.getContext("webgl")
    // SETUP RENDER PROGRAM
      var vertShader = WebGLHelper.loadShader(this.gl, this.gl.VERTEX_SHADER, document.getElementById("shader-vs").textContent)
      var fragShader = WebGLHelper.loadShader(this.gl, this.gl.FRAGMENT_SHADER, document.getElementById("shader-fs").textContent)
      this.renderProgram = WebGLHelper.createProgram(this.gl, vertShader, fragShader)
      this.gl.useProgram(this.renderProgram)
      // provide texture coordinates for the rectangle.
      var texCoordBuffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer)
      WebGLHelper.setRectangle(this.gl,0,0,1,1)

      var texCoordLocation = this.gl.getAttribLocation(this.renderProgram, "a_texCoord")
      this.gl.enableVertexAttribArray(texCoordLocation)
      this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

      var u_image0Location = this.gl.getUniformLocation(this.renderProgram, "u_image")
      this.gl.uniform1i(u_image0Location, 0)  // texture unit 0
  }

  createImage(frame){
    var texture = WebGLHelper.createTexture(this.gl, frame)
    var ret = new GPUImage(this, texture)
    return ret
  }

  setRenderSize(width, height){
    this.gl.canvas.width = width
    this.gl.canvas.height = height
    this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
  }

  render(image:GPUImage){


    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, image.texture)


    // lookup uniforms
    var resolutionLocation = this.gl.getUniformLocation(this.renderProgram, "u_canvasResolution")

    // set the resolution
    this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height)

    // Create a buffer for the position of the rectangle corners.
    var buffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)

    var positionLocation = this.gl.getAttribLocation(this.renderProgram, "a_imageResolutionPosition")
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Stretch so that image fits this.canvas
    WebGLHelper.setRectangle(this.gl, 0, 0, this.canvas.width, this.canvas.height)

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }
}



async function main(){
  //setup camera
  var selectedCamera = (await DeviceManager.findAllVideoDevices())[0]
  var session = await CaptureSession.create(selectedCamera)

  //create gpu device
  var gpuDevice = new GPUDevice()
  gpuDevice.setRenderSize(session.videoElement.videoWidth, session.videoElement.videoHeight)
  document.body.appendChild(gpuDevice.canvas);

  //render to screen
  var draw = ()=>{
    var frame = session.readFrame()
    var image = gpuDevice.createImage(frame)
    gpuDevice.render(image)
    requestAnimationFrame(draw)
  }
  draw()
}
main()
