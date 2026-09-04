// Posts real mouse events to the Simulator window. The Simulator turns a mouse
// drag into a genuine iOS touch, complete with the gesture arbitration that
// synthetic DOM events skip — which is the whole reason this exists.
import CoreGraphics
import Foundation

func post(_ type: CGEventType, _ p: CGPoint) {
  let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)
  e?.post(tap: .cghidEventTap)
}

func sleepMs(_ ms: Double) { usleep(useconds_t(ms * 1000)) }

let a = CommandLine.arguments
switch a[1] {
case "click":
  let p = CGPoint(x: Double(a[2])!, y: Double(a[3])!)
  post(.mouseMoved, p); sleepMs(40)
  post(.leftMouseDown, p); sleepMs(90)
  post(.leftMouseUp, p)

case "drag":
  let x1 = Double(a[2])!, y1 = Double(a[3])!
  let x2 = Double(a[4])!, y2 = Double(a[5])!
  let steps = Int(a[6]) ?? 24
  let stepMs = Double(a[7]) ?? 12

  post(.mouseMoved, CGPoint(x: x1, y: y1)); sleepMs(60)
  post(.leftMouseDown, CGPoint(x: x1, y: y1))
  // A touch that jumps straight to its destination reads as a tap. iOS needs
  // the intermediate movement to classify the gesture at all.
  sleepMs(40)
  for i in 1...steps {
    let t = Double(i) / Double(steps)
    post(.leftMouseDragged, CGPoint(x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t))
    sleepMs(stepMs)
  }
  sleepMs(60)
  post(.leftMouseUp, CGPoint(x: x2, y: y2))

default:
  FileHandle.standardError.write("usage: mouse click X Y | mouse drag X1 Y1 X2 Y2 [steps] [stepMs]\n".data(using: .utf8)!)
  exit(2)
}
