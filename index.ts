"use strict";
navigator.getUserMedia = navigator.getUserMedia || navigator["webkitGetUserMedia"] || navigator["mozGetUserMedia"] || navigator["msGetUserMedia"] || navigator["oGetUserMedia"]

class CaptureSession {
  videoElement:any
  stream:any
  videoDevice:any

  static async create(videoDevice:any){
    return new Promise<CaptureSession>((resolve, reject) => {
      var ret = new CaptureSession()

      ret.videoElement = document.createElement("video")
      ret.videoElement.autoplay = true
      //ret.videoElement.width = 300;
      //ret.videoElement.height = 300;
      //ret.videoElement.style.width="300px"
      //ret.videoElement.style.height="100px"
      //document.body.appendChild(ret.videoElement)

      var videoConstraints:any = {mandatory:{sourceId: videoDevice.deviceId}}
      var stream = navigator.getUserMedia({video: videoConstraints}, (stream)=>{
        //var track = stream.getVideoTracks()
        ret.stream = stream
        ret.videoElement["src"] = window.URL.createObjectURL(stream)
        ret.videoElement.addEventListener("play", ()=>{
          //console.log(ret.videoElement.videoWidth)
          resolve(ret)
        })

      }, (e)=>{
        reject(e)
      })

    })
  }
}

var DeviceManager = {
  findAllVideoDevices: async()=>{
    var devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d)=>d.kind == "videoinput")
  }
}

var runEver

async function main(){
  var selectedCamera = (await DeviceManager.findAllVideoDevices())[0]
  var session = await CaptureSession.create(selectedCamera)

  var canvas:any = document.getElementById('canvas')
  var context = canvas.getContext("2d")
  var draw = ()=>{
    //console.log(session.videoElement.videoWidth)
    try{
      canvas.width = session.videoElement.videoWidth
      canvas.height = session.videoElement.videoHeight

      context.drawImage(session.videoElement, 0, 0, session.videoElement.videoWidth, session.videoElement.videoHeight);
    }catch(e){
      console.log(e)
    }
    requestAnimationFrame(draw)
  }
  draw()
}
main()
