let currentTool = null;
const tools = [];
let temporaryText = null;
let temporaryTextTimer = 0;
let lines = [];
let rectangles = [];
let circles = [];
let curves = [];
let tempPoints = [];
let mouseTrail = [];
const TRAIL_LIFETIME = 3000;
const TRAIL_COLOR = [220, 115, 80];
let hoveredShape = null;

class Line {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  rotate(angle, pivotX, pivotY) {
    const rotatePoint = (x, y) => {
      const dx = x - pivotX;
      const dy = y - pivotY;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: pivotX + (dx * cos - dy * sin),
        y: pivotY + (dx * sin + dy * cos)
      };
    };
  
    const p1 = rotatePoint(this.x1, this.y1);
    const p2 = rotatePoint(this.x2, this.y2);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
  }

  draw(isHovered = false) {
    stroke(isHovered ? 'red' : 0);
    line(this.x1, this.y1, this.x2, this.y2);
  }

  containsPoint(px, py) {
    const buffer = 8; 
    const lineLength = dist(this.x1, this.y1, this.x2, this.y2);
    if (lineLength === 0) return dist(px, py, this.x1, this.y1) <= buffer;
    
    const t = ((px - this.x1) * (this.x2 - this.x1) + (py - this.y1) * (this.y2 - this.y1)) / (lineLength * lineLength);
    const t_clamped = Math.max(0, Math.min(1, t));
    
    const nearestX = this.x1 + t_clamped * (this.x2 - this.x1);
    const nearestY = this.y1 + t_clamped * (this.y2 - this.y1);
    
    return dist(px, py, nearestX, nearestY) <= buffer;
  }
}

class Rectangle {
  constructor(x1, y1, x2, y2) {
    this.x = Math.min(x1, x2);
    this.y = Math.min(y1, y2);
    this.w = Math.abs(x2 - x1);
    this.h = Math.abs(y2 - y1);
  }

  draw(isHovered = false) {
    stroke(isHovered ? 'red' : 0);
    noFill();
    push();
    translate(this.x + this.w/2, this.y + this.h/2);
    rotate(this.rotation || 0);
    rect(-this.w/2, -this.h/2, this.w, this.h);
    pop();
  }

  containsPoint(px, py) {
    const buffer = 8;
    if (this.rotation) {
      const cx = this.x + this.w/2;
      const cy = this.y + this.h/2;
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const dx = px - cx;
      const dy = py - cy;
      const rx = dx * cos - dy * sin + cx;
      const ry = dx * sin + dy * cos + cy;

      return (
        (Math.abs(rx - this.x) <= buffer || Math.abs(rx - (this.x + this.w)) <= buffer) &&
        ry >= this.y - buffer && ry <= this.y + this.h + buffer ||
        (Math.abs(ry - this.y) <= buffer || Math.abs(ry - (this.y + this.h)) <= buffer) &&
        rx >= this.x - buffer && rx <= this.x + this.w + buffer
      );
    } else {
      return (
        (px >= this.x - buffer && px <= this.x + this.w + buffer &&
         py >= this.y - buffer && py <= this.y + buffer) ||
        (px >= this.x - buffer && px <= this.x + this.w + buffer &&
         py >= this.y + this.h - buffer && py <= this.y + this.h + buffer) ||
        (px >= this.x - buffer && px <= this.x + buffer &&
         py >= this.y - buffer && py <= this.y + this.h + buffer) ||
        (px >= this.x + this.w - buffer && px <= this.x + this.w + buffer &&
         py >= this.y - buffer && py <= this.y + this.h + buffer)
      );
    }
   }

  rotate(angle, pivotX, pivotY) {
    const dx = this.x + this.w/2 - pivotX;
    const dy = this.y + this.h/2 - pivotY;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const newCenterX = pivotX + (dx * cos - dy * sin);
    const newCenterY = pivotY + (dx * sin + dy * cos);
    
    this.x = newCenterX - this.w/2;
    this.y = newCenterY - this.h/2;
    this.rotation = (this.rotation || 0) + angle;
  }
  
}

class Circle {
  constructor(centerX, centerY, radius) {
    this.x = centerX;
    this.y = centerY;
    this.radius = radius;
  }

  draw(isHovered = false) {
    stroke(isHovered ? 'red' : 0);
    noFill();
    circle(this.x, this.y, this.radius * 2);
  }

  containsPoint(px, py) {
    const buffer = 8;
    const d = dist(px, py, this.x, this.y);
    return Math.abs(d - this.radius) <= buffer;
  }

  rotate(angle, pivotX, pivotY) {
    const dx = this.x - pivotX;
    const dy = this.y - pivotY;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    this.x = pivotX + (dx * cos - dy * sin);
    this.y = pivotY + (dx * sin + dy * cos);
  }

}

class QuadraticBezier {
  constructor(x1, y1, cx, cy, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.cx = cx;
    this.cy = cy;
    this.x2 = x2;
    this.y2 = y2;
  }

  draw(isHovered = false) {
    stroke(isHovered ? 'red' : 0);
    noFill();
    beginShape();
    vertex(this.x1, this.y1);
    quadraticVertex(this.cx, this.cy, this.x2, this.y2);
    endShape();
  }

  containsPoint(px, py) {
    const steps = 100; 
    const buffer = 8;  
    if (dist(px, py, this.x1, this.y1) <= buffer ||
        dist(px, py, this.x2, this.y2) <= buffer ||
        dist(px, py, this.cx, this.cy) <= buffer) {
      return true;
    }
    
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = Math.pow(1 - t, 2) * this.x1 + 2 * (1 - t) * t * this.cx + Math.pow(t, 2) * this.x2;
      const y = Math.pow(1 - t, 2) * this.y1 + 2 * (1 - t) * t * this.cy + Math.pow(t, 2) * this.y2;
      if (dist(px, py, x, y) <= buffer) {
        return true;
      }
    }
    return false;
  }

  rotate(angle, pivotX, pivotY) {
    const rotatePoint = (x, y) => {
      const dx = x - pivotX;
      const dy = y - pivotY;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: pivotX + (dx * cos - dy * sin),
        y: pivotY + (dx * sin + dy * cos)
      };
    };
  
    const p1 = rotatePoint(this.x1, this.y1);
    const p2 = rotatePoint(this.x2, this.y2);
    const pc = rotatePoint(this.cx, this.cy);
    
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.cx = pc.x;
    this.cy = pc.y;
  }

}

class Tool {
  constructor(name, icon, x, y) {
    this.name = name;
    this.icon = icon;
    this.x = x;
    this.y = y;
    this.size = 40;
    tools.push(this);
  }

  draw() {
    stroke(0);
    fill(this === currentTool ? '#ADD8E6' : '#FFFFFF');
    rect(this.x, this.y, this.size, this.size);
    push();
    translate(this.x + this.size/2, this.y + this.size/2);
    this.drawIcon();
    pop();
  }

  drawIcon() {
  }

  isClicked(px, py) {
    return px > this.x && px < this.x + this.size &&
           py > this.y && py < this.y + this.size;
  }
}

class LineTool extends Tool {
  drawIcon() {
    stroke(0);
    line(-15, -15, 15, 15);
  }

  handlePress(x, y) {
    if (x < 70) return;
    
    if (!tempPoints.length) {
      tempPoints.push({ x, y });
    } else {
      lines.push(new Line(tempPoints[0].x, tempPoints[0].y, x, y));
      tempPoints = [];
    }
  }

  drawPreview() {
    if (tempPoints.length === 1) {
      stroke(0, 0, 0, 128);
      line(tempPoints[0].x, tempPoints[0].y, mouseX, mouseY);
    }
  }
}

class RectangleTool extends Tool {
  drawIcon() {
    stroke(0);
    noFill();
    rect(-12, -12, 24, 24);
  }

  handlePress(x, y) {
    if (x < 70) return;
    
    if (!tempPoints.length) {
      tempPoints.push({ x, y });
    } else {
      rectangles.push(new Rectangle(tempPoints[0].x, tempPoints[0].y, x, y));
      tempPoints = [];
    }
  }

  drawPreview() {
    if (tempPoints.length === 1) {
      stroke(0, 0, 0, 128);
      noFill();
      const previewRect = new Rectangle(tempPoints[0].x, tempPoints[0].y, mouseX, mouseY);
      previewRect.draw();
    }
  }
}

class CircleTool extends Tool {
  drawIcon() {
    stroke(0);
    noFill();
    circle(0, 0, 24);
  }

  handlePress(x, y) {
    if (x < 70) return;
    
    if (!tempPoints.length) {
      tempPoints.push({ x, y });
    } else {
      const radius = dist(tempPoints[0].x, tempPoints[0].y, x, y);
      circles.push(new Circle(tempPoints[0].x, tempPoints[0].y, radius));
      tempPoints = [];
    }
  }

  drawPreview() {
    if (tempPoints.length === 1) {
      stroke(0, 0, 0, 128);
      noFill();
      const radius = dist(tempPoints[0].x, tempPoints[0].y, mouseX, mouseY);
      circle(tempPoints[0].x, tempPoints[0].y, radius * 2);
    }
  }
}

class BezierTool extends Tool {
  drawIcon() {
    stroke(0);
    noFill();
    beginShape();
    vertex(-15, -15);
    quadraticVertex(15, -15, 15, 15);
    endShape();
  }

  handlePress(x, y) {
    if (x < 70) return;
    
    tempPoints.push({ x, y });
    
    if (tempPoints.length === 3) {
      curves.push(new QuadraticBezier(
        tempPoints[0].x, tempPoints[0].y,
        tempPoints[1].x, tempPoints[1].y,
        tempPoints[2].x, tempPoints[2].y
      ));
      tempPoints = [];
    }
  }

  drawPreview() {
    if (tempPoints.length > 0) {
      stroke(0, 0, 0, 128);
      noFill();
      
      fill(0, 0, 0, 128);
      for (let point of tempPoints) {
        circle(point.x, point.y, 5);
      }
      
      noFill();
      if (tempPoints.length === 1) {
        line(tempPoints[0].x, tempPoints[0].y, mouseX, mouseY);
      } else if (tempPoints.length === 2) {
        beginShape();
        vertex(tempPoints[0].x, tempPoints[0].y);
        quadraticVertex(tempPoints[1].x, tempPoints[1].y, mouseX, mouseY);
        endShape();
      }
    }
  }
}

class EraserTool extends Tool {
  drawIcon() {
    stroke(0);
    fill(255);
    rect(-10, -10, 20, 20);
    line(-7, -7, 7, 7);
    line(-7, 7, 7, -7);
  }

  handlePress(x, y) {
    if (hoveredShape) {
      const shapes = [lines, rectangles, circles, curves];
      const arrays = shapes.map(arr => arr.filter(shape => shape !== hoveredShape));
      [lines, rectangles, circles, curves] = arrays;
      hoveredShape = null;
    }
  }

  drawPreview() {
  }
}

class RotationTool extends Tool {
  constructor(name, icon, x, y) {
    super(name, icon, x, y);
    this.selectedShape = null;
    this.pivotSet = false;
    this.pivotX = 0;
    this.pivotY = 0;
    this.startAngle = 0;
  }

  drawIcon() {
    stroke(0);
    noFill();
    arc(0, 0, 20, 20, -PI/2, PI);
    line(0, -10, 8, -13);
    line(0, -10, 6, -1);
  }

  handlePress(x, y) {
    if (x < 70) return;

    if (!this.selectedShape) {
      for (let shape of [...lines, ...rectangles, ...circles, ...curves]) {
        if (shape.containsPoint(x, y)) {
          this.selectedShape = shape;
          break;
        }
      }
    } else if (!this.pivotSet) {
      this.pivotX = x;
      this.pivotY = y;
      this.pivotSet = true;
      this.startAngle = Math.atan2(mouseY - this.pivotY, mouseX - this.pivotX);
    } else {
      this.selectedShape = null;
      this.pivotSet = false;
    }
  }

  drawPreview() {
    if (!this.selectedShape) {
      let allShapes = [...lines, ...rectangles, ...circles, ...curves];
      for (let shape of allShapes) {
        if (shape.containsPoint(mouseX, mouseY)) {
          stroke(255, 165, 0); 
          shape.draw(true);
          break;
        }
      }
    } else {
      stroke(0, 255, 0);
      this.selectedShape.draw(true);
      
      if (this.pivotSet) {
        stroke(255, 0, 0);
        fill(255, 0, 0);
        circle(this.pivotX, this.pivotY, 8);
      } else {
        stroke(255, 0, 0, 128);
        noFill();
        circle(mouseX, mouseY, 8);
      }
    }
  }
}

function updateMouseTrail() {
  const currentTime = Date.now();
  if (mouseX > 0 && mouseX < windowWidth && mouseY > 0 && mouseY < windowHeight) {

    if (mouseTrail.length === 0 || 
        mouseTrail[mouseTrail.length - 1].x !== mouseX || 
        mouseTrail[mouseTrail.length - 1].y !== mouseY) {
      mouseTrail.push({
        x: mouseX,
        y: mouseY,
        timestamp: currentTime
      });
    }
  }
  mouseTrail = mouseTrail.filter(point => 
    currentTime - point.timestamp < TRAIL_LIFETIME
  );
}

function drawMouseTrail() {
  const currentTime = Date.now();
  
  noFill();
  
  beginShape();
  for (let i = 0; i < mouseTrail.length; i++) {
    const point = mouseTrail[i];
    const age = currentTime - point.timestamp;
    const alpha = map(age, 0, TRAIL_LIFETIME, 3000, 0);
    
    stroke(TRAIL_COLOR[0], TRAIL_COLOR[1], TRAIL_COLOR[2], alpha);
    
    if (i === 0) {
      vertex(point.x, point.y);
    } else {
      const prev = mouseTrail[i - 1];
      const distance = dist(point.x, point.y, prev.x, prev.y);
      
      if (distance < 50) {
       
        vertex(point.x, point.y);
      } else {
      
        const steps = Math.ceil(distance / 100);
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const interpX = lerp(prev.x, point.x, t);
          const interpY = lerp(prev.y, point.y, t);
          vertex(interpX, interpY);
        }
      }
    }
  }
  endShape();
}

function displayTemporaryText(text) {
  temporaryText = text;
  temporaryTextTimer = millis() + 12000;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('monospace');
  
  const toolSpacing = 50;
  new LineTool('line', null, 20, 20);
  new RectangleTool('rectangle', null, 20, 20 + toolSpacing);
  new CircleTool('circle', null, 20, 20 + toolSpacing * 2);
  new BezierTool('bezier', null, 20, 20 + toolSpacing * 3);
  new EraserTool('eraser', null, 20, 20 + toolSpacing * 4);
  new RotationTool('rotation', null, 20, 20 + toolSpacing * 5);
}

function draw() {
  background(255);
  
  updateMouseTrail();
  
  fill(255);
  noStroke();
  rect(0, 0, 70, height);
  
  drawMouseTrail();

  fill(0);
  noStroke();
  textSize(15);
  textAlign(LEFT, TOP);
  text('life is on the line_', 70, 20);

 let displayText = (temporaryText !== null && millis() < temporaryTextTimer) ? temporaryText 
  : 'modern architecture is no longer a solely human endeavor. \n\n<< human intention, \n<< digital systems, \n<< algorithmic logic. \n\nIt is (more.than.human). It is digital.';

fill(0);
noStroke();
textSize(10);
textAlign(CENTER, TOP);
text(displayText, windowWidth/2, height/2);
  
  
  fill(0);
  noStroke();
  textSize(10);
  textAlign(LEFT, TOP);
  text('0001__(beyond tools) \n0010__(the fallacy of the perfect line) \n0011__(subversion through collaboration) \n0100__(hidden biases) \n0101__(reclaiming aesthetic) \n0110__(towards imperfect) \n0111__(flawless probugtion) \n1000__(experimentation is resistance) \n\nthank you for engaging with this project.amh',20, height - 150);
  
  hoveredShape = null;
  if (currentTool instanceof EraserTool && mouseX > 70) {
    for (let shape of [...lines, ...rectangles, ...circles, ...curves]) {
      if (shape.containsPoint(mouseX, mouseY)) {
        hoveredShape = shape;
        break;
      }
    }
  }
  
  for (let tool of tools) {
    tool.draw();
  }
  
  for (let l of lines) {
    l.draw(l === hoveredShape);
  }
  
  for (let r of rectangles) {
    r.draw(r === hoveredShape);
  }
  
  for (let c of circles) {
    c.draw(c === hoveredShape);
  }
  
  for (let curve of curves) {
    curve.draw(curve === hoveredShape);
  }
  
  if (currentTool && tempPoints.length > 0) {
    currentTool.drawPreview();
  }
}

function mousePressed() {
  const textAreaLeft = 20;
  const textAreaTop = height - 150;
  const textAreaRight = 300;
  const textAreaBottom = height;

  if (mouseX > textAreaLeft && mouseX < textAreaRight && mouseY > textAreaTop && mouseY < textAreaBottom) {
    const lineHeight = 13;
    const clickedLineIndex = Math.floor((mouseY - textAreaTop) / lineHeight);

    const lines = [
      { text: "0001__(beyond tools)", content: "0001__(beyond tools)\n\nthe pervasive influence of computer-aided design [cad] is more than a mere neutral instrument.\n[cad] systems subtly steer architectural outcomes towards efficiency, rationality,\nand standardization values undermining the potential for, life in design and beauty from irrationality." },
      { text: "0010__(the fallacy of the perfect line)", content: "0010__(the fallacy of the perfect line) \n\nthe perfectly straight line is the fundament of [cad] driven design.\nit is a mathematical abstraction defined as the shortest distance between two points, alien to the irregularity of the natural world.\nit does not exist. it is an idea not an ideal and needs to be rejected as the foundation of architectural processes.\ndesign must embrace imperfection." },
      { text: "0011__(subversion through collaboration)", content: "0011__(subversion through collaboration) \n\nwhile [cad] tools are positioned as enablers of precision, they influence creativity by imposing rigid frameworks.\nit can only be created what the system is capable of computing.\na conscious collaboration with these tools, subverting their default tendencies to\nexplore designs that defy conventions and celebrate unpredictability, is imperative." },
      { text: "0100__(hidden biases)", content: "0100__(hidden biases)\n\n [cad] is never neutral.\nalgorithms and default settings reflect cultural, economic, and technological biases\nthat are a gateway to uniformity and commodification.\nthey carry inherent logic that is derived from software development not architecture or design.\narchitects must interrogate these biases and reclaim agency in the design process, resisting the homogenization of the built environment." },
      { text: "0101__(reclaiming aesthetic)", content: "0101__(reclaiming aesthetic) \n\n a system based on algorithms is fundamentally geared towards efficiency.\nefficiency, however, must never be an innate virtue in architecture.\nemotional resonance must take precedence over sterile neocapitalistic optimization.\nthe dominance of [cad]’s metrics-driven logic must be challenged at all times." },
      { text: "0110__(towards imperfect)", content: "0110__(towards imperfect) \n\nirregularity, texture, and unexpected qualities are the life of our entire environment.\nthe digital realm should not erase these attributes but amplify them,\nallowing us to craft spaces that resonate with human and ecological vitality." },
      { text: "0111__(flawless probugtion)", content: "0111_(flawless probugtion) \n\na computer bug, often seen as an error, is a reminder that the digital realm is not immune to the unpredictability of creation.\nbugs tear the illusion of total control, perfection and precision, introducing chaos and unintended consequences into architectural production.\nfrustration yields appreciation." },
      { text: "1000__(experimentation is resistance)", content: "1000__(experimentation is resistance) \n\nin the face of [cad]’s underlying push for standardization, experimentation becomes an act of resistance.\narchitects and designers need to use digital tools not to conform but to, seek out\nnew paradigms that challenge the norms of architectural production.\nif the machine fails, freezes or crashes you have found one of many invisible barriers." },     
      { text: "", content: "modern architecture is no longer a solely human endeavor. \n\n<< human intention, \n<< digital systems, \n<< algorithmic logic. \n\nIt is (more.than.human). It is digital." },
      { text: "thank you for engaging with this project.amh", content: ".augustin michael heinen for 'more than human' at tu berlin" }
    ];

    if (clickedLineIndex >= 0 && clickedLineIndex < lines.length) {
      displayTemporaryText(lines[clickedLineIndex].content);
    }
  }

  for (let tool of tools) {
    if (tool.isClicked(mouseX, mouseY)) {
      if (currentTool === tool) {
        currentTool = null;
      } else {
        currentTool = tool;
        tempPoints = [];
      }
      return;
    }
  }
  
  if (currentTool) {
    currentTool.handlePress(mouseX, mouseY);
  }
}


function mouseDragged() {
  if (currentTool instanceof RotationTool && currentTool.selectedShape && currentTool.pivotSet) {
    const currentAngle = Math.atan2(mouseY - currentTool.pivotY, mouseX - currentTool.pivotX);
    const rotationAngle = currentAngle - currentTool.startAngle;
    currentTool.selectedShape.rotate(rotationAngle, currentTool.pivotX, currentTool.pivotY);
    currentTool.startAngle = currentAngle;
  }
}

function mouseReleased() {
  if (currentTool) {
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}