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

    gl.useProgram(ret)
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
  }
}

async function main(){
  //setup camera
  var selectedCamera = (await DeviceManager.findAllVideoDevices())[0]
  var session = await CaptureSession.create(selectedCamera)

  //create canvas
  var canvas:any = document.getElementById('canvas')
  canvas.width = session.videoElement.videoWidth
  canvas.height = session.videoElement.videoHeight
  var gl = canvas.getContext("webgl")

  //load shaders
  var vertShader = WebGLHelper.loadShader(gl, gl.VERTEX_SHADER, document.getElementById("shader-vs").textContent)
  var fragShader = WebGLHelper.loadShader(gl, gl.FRAGMENT_SHADER, document.getElementById("shader-fs").textContent)
  var program = WebGLHelper.createProgram(gl, vertShader, fragShader)

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_imageResolutionPosition")
  var texCoordLocation = gl.getAttribLocation(program, "a_texCoord")

  // provide texture coordinates for the rectangle.
  var texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  WebGLHelper.setRectangle(gl,0,0,1,1)
  gl.enableVertexAttribArray(texCoordLocation)
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  var u_image0Location = gl.getUniformLocation(program, "u_image")
  gl.uniform1i(u_image0Location, 0)  // texture unit 0

  //render to screen
  var draw = ()=>{
    var frame = session.readFrame()
    var data = frame.data

    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)


    // lookup uniforms
    var resolutionLocation = gl.getUniformLocation(program, "u_canvasResolution")

    // set the resolution
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
    // Create a buffer for the position of the rectangle corners.
    var buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Stretch so that image fits canvas
    WebGLHelper.setRectangle(gl, 0, 0, canvas.width, canvas.height)

    gl.drawArrays(gl.TRIANGLES, 0, 6)


    requestAnimationFrame(draw)
  }
  draw()
}
main()
