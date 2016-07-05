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


async function main(){
  //setup camera
  var selectedCamera = (await DeviceManager.findAllVideoDevices())[0]
  var session = await CaptureSession.create(selectedCamera)

  //create canvas
  var canvas:any = document.getElementById('canvas')
  canvas.width = session.videoElement.videoWidth
  canvas.height = session.videoElement.videoHeight
  var context = canvas.getContext("2d")

  //render to screen
  var draw = ()=>{
    var frame = session.readFrame()
    var data = frame.data;
    
    for (var i = 0, j = 0; j < data.length; i++, j += 4) {
        data[j + 0] = data[j + 1]
        data[j + 1] = data[j + 1]
        data[j + 2] = data[j + 1]
    }

    context.putImageData(frame, 0, 0);
    requestAnimationFrame(draw)
  }
  draw()
}
main()
