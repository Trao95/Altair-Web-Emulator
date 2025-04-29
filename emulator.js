// Intel 8080 CPU Emulation
class Intel8080 {
    constructor() {
        this.reset();
    }

    reset() {
        this.a = 0;
        this.b = 0;
        this.c = 0;
        this.d = 0;
        this.e = 0;
        this.h = 0;
        this.l = 0;
        this.pc = 0;
        this.sp = 0xFFFF;
        this.flags = { z: false, s: false, p: false, cy: false, ac: false };
        this.status = {
            halted: false,
            interruptsEnabled: false,
            wait: false,
            memRead: false,
            input: false,
            output: false,
            m1: false,
        };
    }

    step(memory, io) {
        if (this.status.halted) return 0;

        this.status.m1 = true;
        const opcode = memory.read(this.pc++);
        let cycles = 1;

        switch (opcode) {
            case 0x00: // NOP
                break;
            case 0x76: // HLT
                this.status.halted = true;
                break;
            case 0xC3: // JMP addr
                this.pc = memory.read(this.pc) | (memory.read(this.pc + 1) << 8);
                cycles = 3;
                break;
            case 0x3E: // MVI A, d8
                this.a = memory.read(this.pc++);
                cycles = 2;
                break;
            case 0x80: // ADD B
                this.a = (this.a + this.b) & 0xFF;
                this.updateFlags(this.a);
                break;
            case 0xD3: // OUT port
                this.status.output = true;
                io.output(memory.read(this.pc++), this.a);
                cycles = 2;
                break;
            case 0xDB: // IN port
                this.status.input = true;
                this.a = io.input(memory.read(this.pc++));
                cycles = 2;
                break;
            default:
                console.log(`Unimplemented opcode: 0x${opcode.toString(16)}`);
                this.status.halted = true;
        }

        this.status.m1 = false;
        return cycles;
    }

    updateFlags(value) {
        this.flags.z = value === 0;
        this.flags.s = (value & 0x80) !== 0;
        this.flags.p = this.parity(value);
        this.flags.cy = value > 0xFF;
    }

    parity(value) {
        let count = 0;
        for (let i = 0; i < 8; i++) {
            if (value & (1 << i)) count++;
        }
        return count % 2 === 0;
    }

    getState() {
        return {
            a: this.a,
            b: this.b,
            c: this.c,
            d: this.d,
            e: this.e,
            h: this.h,
            l: this.l,
            pc: this.pc,
            sp: this.sp,
            flags: this.flags,
            status: this.status
        };
    }
}

// Memory
class Memory {
    constructor(size = 65536) {
        this.size = size;
        this.data = new Uint8Array(size);
    }

    reset() {
        this.data.fill(0);
    }

    read(address) {
        return this.data[address & 0xFFFF];
    }

    write(address, value) {
        this.data[address & 0xFFFF] = value & 0xFF;
    }

    loadProgram(startAddress, program) {
        for (let i = 0; i < program.length; i++) {
            this.write(startAddress + i, program[i]);
        }
    }
}

// I/O
class IO {
    constructor(terminal) {
        this.terminal = terminal;
        this.inputBuffer = "";
        this.inputCallback = null;
    }

    input(port) {
        if (port === 0x01 && this.inputBuffer) {
            const char = this.inputBuffer.charCodeAt(0);
            this.inputBuffer = this.inputBuffer.slice(1);
            return char;
        }
        return 0;
    }

    output(port, value) {
        if (port === 0x01) {
            this.terminal.print(String.fromCharCode(value));
        }
    }

    setInput(text, callback) {
        this.inputBuffer += text;
        if (callback) this.inputCallback = callback;
    }

    resolveInput() {
        if (this.inputCallback) {
            this.inputCallback();
            this.inputCallback = null;
        }
    }
}

// Terminal
class Terminal {
    constructor(element) {
        this.element = element;
        this.buffer = "";
        this.clear();
    }

    clear() {
        this.element.textContent = "";
        this.buffer = "";
    }

    print(text) {
        this.buffer += text;
        this.element.textContent = this.buffer;
        this.element.scrollTop = this.element.scrollHeight;
    }

    println(text) {
        this.print(text + "\n");
    }
}

// Altair BASIC Interpreter
class BasicInterpreter {
    constructor(terminal, io) {
        this.terminal = terminal;
        this.io = io;
        this.program = {};
        this.variables = {};
        this.arrays = {};
        this.lineNumbers = [];
        this.currentLine = 0;
        this.running = false;
        this.forLoops = [];
        this.returnStack = [];
        this.waitingForInput = false;
        this.initialized = false;
    }

    initialize() {
        this.terminal.println("ALTAIR BASIC VERSION 4.0");
        this.terminal.println("COPYRIGHT 1975 BY MITS AND BILL GATES");
        this.terminal.println("OK");
        this.initialized = true;
        this.running = true;
    }

    tokenize(line) {
        const tokens = [];
        let current = "";
        let inString = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];

            if (char === '"') {
                if (inString) {
                    current += char;
                    tokens.push(current);
                    current = "";
                    inString = false;
                } else {
                    if (current) tokens.push(current);
                    current = char;
                    inString = true;
                }
                i++;
            } else if (inString) {
                current += char;
                i++;
            } else if (/\s/.test(char)) {
                if (current) {
                    tokens.push(current);
                    current = "";
                }
                i++;
            } else if (/[+\-*/^=<>(),;]/.test(char)) {
                if (current) {
                    tokens.push(current);
                    current = "";
                }
                tokens.push(char);
                i++;
            } else {
                current += char;
                i++;
            }
        }

        if (current) tokens.push(current);
        return tokens;
    }

    executeCommand(command) {
        if (!this.initialized) {
            this.initialize();
        }

        command = command.trim();
        if (!command) return;

        const lineMatch = command.match(/^(\d+)\s+(.*)/);
        if (lineMatch) {
            const lineNumber = parseInt(lineMatch[1]);
            const code = lineMatch[2].trim();
            this.program[lineNumber] = code;
            this.lineNumbers = Object.keys(this.program).map(Number).sort((a, b) => a - b);
            this.terminal.println("");
            return;
        }

        const tokens = this.tokenize(command);
        const cmd = tokens[0]?.toUpperCase();

        switch (cmd) {
            case "LIST":
                this.listProgram();
                break;
            case "RUN":
                this.runProgram();
                break;
            case "NEW":
                this.program = {};
                this.variables = {};
                this.arrays = {};
                this.lineNumbers = [];
                this.forLoops = [];
                this.returnStack = [];
                this.terminal.println("OK");
                break;
            default:
                this.executeStatement(tokens, true);
        }
    }

    listProgram() {
        for (const lineNumber of this.lineNumbers) {
            if (this.program[lineNumber]) {
                this.terminal.println(`${lineNumber} ${this.program[lineNumber]}`);
            }
        }
        this.terminal.println("OK");
    }

    runProgram() {
        this.variables = {};
        this.arrays = {};
        this.forLoops = [];
        this.returnStack = [];
        this.currentLine = 0;
        this.running = true;
        this.executeNextLine();
    }

    executeNextLine() {
        if (!this.running || this.currentLine >= this.lineNumbers.length || this.waitingForInput) {
            if (!this.waitingForInput) {
                this.running = false;
                this.terminal.println("OK");
            }
            return;
        }

        const lineNumber = this.lineNumbers[this.currentLine];
        const statement = this.program[lineNumber];
        this.currentLine++;
        this.executeStatement(this.tokenize(statement), false);
    }

    executeStatement(tokens, immediate) {
        if (!tokens.length) {
            if (!immediate) this.executeNextLine();
            return;
        }

        const cmd = tokens[0].toUpperCase();
        switch (cmd) {
            case "PRINT":
                this.executePrint(tokens.slice(1), immediate);
                break;
            case "INPUT":
                this.executeInput(tokens.slice(1), immediate);
                break;
            case "LET":
                this.executeLet(tokens.slice(1), immediate);
                break;
            case "IF":
                this.executeIf(tokens.slice(1), immediate);
                break;
            case "GOTO":
                this.executeGoto(tokens.slice(1));
                break;
            case "GOSUB":
                this.executeGosub(tokens.slice(1));
                break;
            case "RETURN":
                this.executeReturn(immediate);
                break;
            case "FOR":
                this.executeFor(tokens.slice(1), immediate);
                break;
            case "NEXT":
                this.executeNext(tokens.slice(1), immediate);
                break;
            case "END":
                this.running = false;
                this.terminal.println("OK");
                break;
            case "DIM":
                this.executeDim(tokens.slice(1), immediate);
                break;
            default:
                this.executeLet([cmd, ...tokens.slice(1)], immediate);
        }
    }

    executePrint(tokens, immediate) {
        let output = "";
        let i = 0;
        while (i < tokens.length) {
            if (tokens[i] === ",") {
                output += " ";
                i++;
                continue;
            }
            if (tokens[i] === ";") {
                i++;
                continue;
            }
            if (tokens[i].startsWith('"')) {
                output += tokens[i].slice(1, -1);
                i++;
            } else {
                const exprTokens = [];
                while (i < tokens.length && tokens[i] !== "," && tokens[i] !== ";") {
                    exprTokens.push(tokens[i]);
                    i++;
                }
                output += this.evaluateExpression(exprTokens.join(" "));
            }
        }
        this.terminal.println(output);
        if (!immediate && !this.waitingForInput) this.executeNextLine();
    }

    executeInput(tokens, immediate) {
        const varName = tokens[0].toUpperCase();
        this.terminal.print("? ");
        this.waitingForInput = true;
        this.io.setInput("", () => {
            const input = this.io.inputBuffer.trim();
            this.io.inputBuffer = "";
            this.variables[varName] = isNaN(input) ? input : parseFloat(input);
            this.waitingForInput = false;
            this.terminal.println(input);
            if (!immediate) this.executeNextLine();
        });
    }

    executeLet(tokens, immediate) {
        const eqIndex = tokens.indexOf("=");
        if (eqIndex === -1) {
            this.terminal.println("SYNTAX ERROR");
            return;
        }
        const varName = tokens[0].toUpperCase();
        const expr = tokens.slice(eqIndex + 1).join(" ");
        if (varName.includes("(")) {
            const match = varName.match(/([A-Z])\((\d+)\)/);
            if (!match) {
                this.terminal.println("SYNTAX ERROR");
                return;
            }
            const arrName = match[1];
            const index = parseInt(match[2]);
            if (!this.arrays[arrName] || index >= this.arrays[arrName].length) {
                this.terminal.println("ARRAY BOUNDS ERROR");
                return;
            }
            this.arrays[arrName][index] = this.evaluateExpression(expr);
        } else {
            this.variables[varName] = this.evaluateExpression(expr);
        }
        if (!immediate) this.executeNextLine();
    }

    executeIf(tokens, immediate) {
        const thenIndex = tokens.indexOf("THEN");
        if (thenIndex === -1) {
            this.terminal.println("SYNTAX ERROR");
            return;
        }
        const condition = tokens.slice(0, thenIndex).join(" ");
        const action = tokens.slice(thenIndex + 1).join(" ");
        if (this.evaluateCondition(condition)) {
            const actionTokens = this.tokenize(action);
            if (/^\d+$/.test(actionTokens[0])) {
                this.executeGoto([actionTokens[0]]);
            } else {
                this.executeStatement(actionTokens, immediate);
            }
        } else if (!immediate) {
            this.executeNextLine();
        }
    }

    executeGoto(tokens) {
        const target = parseInt(tokens[0]);
        const index = this.lineNumbers.indexOf(target);
        if (index === -1) {
            this.terminal.println("UNDEFINED LINE NUMBER");
            this.running = false;
            return;
        }
        this.currentLine = index;
        this.executeNextLine();
    }

    executeGosub(tokens) {
        const target = parseInt(tokens[0]);
        const index = this.lineNumbers.indexOf(target);
        if (index === -1) {
            this.terminal.println("UNDEFINED LINE NUMBER");
            this.running = false;
            return;
        }
        this.returnStack.push(this.currentLine);
        this.currentLine = index;
        this.executeNextLine();
    }

    executeReturn(immediate) {
        if (!this.returnStack.length) {
            this.terminal.println("RETURN WITHOUT GOSUB");
            this.running = false;
            return;
        }
        this.currentLine = this.returnStack.pop();
        if (!immediate) this.executeNextLine();
    }

    executeFor(tokens, immediate) {
        const eqIndex = tokens.indexOf("=");
        const toIndex = tokens.indexOf("TO");
        if (eqIndex === -1 || toIndex === -1) {
            this.terminal.println("SYNTAX ERROR");
            return;
        }
        const varName = tokens[0].toUpperCase();
        const start = this.evaluateExpression(tokens.slice(eqIndex + 1, toIndex).join(" "));
        const end = this.evaluateExpression(tokens.slice(toIndex + 1).join(" "));
        this.variables[varName] = start;
        this.forLoops.push({
            varName,
            end,
            returnLine: this.currentLine
        });
        if (!immediate) this.executeNextLine();
    }

    executeNext(tokens, immediate) {
        const varName = tokens[0].toUpperCase();
        const loop = this.forLoops.find(l => l.varName === varName);
        if (!loop) {
            this.terminal.println("NEXT WITHOUT FOR");
            this.running = false;
            return;
        }
        this.variables[varName] = (this.variables[varName] || 0) + 1;
        if (this.variables[varName] <= loop.end) {
            this.currentLine = loop.returnLine;
            this.executeNextLine();
        } else {
            this.forLoops = this.forLoops.filter(l => l.varName !== varName);
            if (!immediate) this.executeNextLine();
        }
    }

    executeDim(tokens, immediate) {
        const match = tokens[0].match(/([A-Z])\((\d+)\)/);
        if (!match) {
            this.terminal.println("SYNTAX ERROR");
            return;
        }
        const arrName = match[1].toUpperCase();
        const size = parseInt(match[2]);
        this.arrays[arrName] = new Array(size).fill(0);
        if (!immediate) this.executeNextLine();
    }

    evaluateExpression(expr) {
        expr = expr.trim().toUpperCase();
        if (/^\d+(\.\d+)?$/.test(expr)) return parseFloat(expr);
        if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
        if (/^[A-Z][A-Z0-9]*$/.test(expr)) return this.variables[expr] || 0;
        if (expr.match(/^[A-Z]\(\d+\)$/)) {
            const match = expr.match(/([A-Z])\((\d+)\)/);
            const arrName = match[1];
            const index = parseInt(match[2]);
            return this.arrays[arrName]?.[index] || 0;
        }

        const functions = {
            SIN: x => Math.sin(x),
            COS: x => Math.cos(x),
            TAN: x => Math.tan(x),
            SQR: x => Math.sqrt(x),
            RND: () => Math.random(),
            INT: x => Math.floor(x),
            ABS: x => Math.abs(x)
        };

        if (expr.match(/^(SIN|COS|TAN|SQR|RND|INT|ABS)\(.+\)$/)) {
            const match = expr.match(/^([A-Z]+)\((.+)\)$/);
            const func = match[1];
            const arg = this.evaluateExpression(match[2]);
            return functions[func](arg);
        }

        try {
            const evalString = expr.replace(/[A-Z][A-Z0-9]*/g, match => {
                return this.variables[match] !== undefined ? this.variables[match] : 0;
            }).replace(/\^/g, "**");
            return eval(evalString);
        } catch (e) {
            this.terminal.println("ERROR IN EXPRESSION");
            return 0;
        }
    }

    evaluateCondition(condition) {
        const parts = condition.match(/(.+)(=|>|<|>=|<=|<>)(.+)/);
        if (!parts) return false;
        const left = this.evaluateExpression(parts[1].trim());
        const op = parts[2];
        const right = this.evaluateExpression(parts[3].trim());
        switch (op) {
            case "=": return left === right;
            case ">": return left > right;
            case "<": return left < right;
            case ">=": return left >= right;
            case "<=": return left <= right;
            case "<>": return left !== right;
            default: return false;
        }
    }
}

// Altair Panel
class AltairPanel {
    constructor(altair) {
        this.altair = altair;
        this.addressSwitches = [];
        this.dataSwitches = [];
        this.addressLeds = [];
        this.dataLeds = [];
        this.initializeUI();
        this.attachEventListeners();
    }

    initializeUI() {
        const addressSwitchesContainer = document.getElementById('address-switches');
        for (let i = 15; i >= 0; i--) {
            const switchGroup = document.createElement('div');
            switchGroup.className = 'switch-group';
            const switchElem = document.createElement('div');
            switchElem.className = 'switch down';
            switchElem.dataset.bit = i;
            const switchLabel = document.createElement('div');
            switchLabel.className = 'switch-label';
            switchLabel.textContent = i;
            switchGroup.appendChild(switchElem);
            switchGroup.appendChild(switchLabel);
            addressSwitchesContainer.appendChild(switchGroup);
            this.addressSwitches[i] = switchElem;
        }

        const dataSwitchesContainer = document.getElementById('data-switches');
        for (let i = 7; i >= 0; i--) {
            const switchGroup = document.createElement('div');
            switchGroup.className = 'switch-group';
            const switchElem = document.createElement('div');
            switchElem.className = 'switch down';
            switchElem.dataset.bit = i;
            const switchLabel = document.createElement('div');
            switchLabel.className = 'switch-label';
            switchLabel.textContent = i;
            switchGroup.appendChild(switchElem);
            switchGroup.appendChild(switchLabel);
            dataSwitchesContainer.appendChild(switchGroup);
            this.dataSwitches[i] = switchElem;
        }

        const addressLedsContainer = document.getElementById('address-leds');
        for (let i = 15; i >= 0; i--) {
            const ledGroup = document.createElement('div');
            ledGroup.className = 'led-group';
            const led = document.createElement('div');
            led.className = 'led';
            led.dataset.bit = i;
            const ledLabel = document.createElement('div');
            ledLabel.className = 'led-label';
            ledLabel.textContent = i;
            ledGroup.appendChild(led);
            ledGroup.appendChild(ledLabel);
            addressLedsContainer.appendChild(ledGroup);
            this.addressLeds[i] = led;
        }

        const dataLedsContainer = document.getElementById('data-leds');
        for (let i = 7; i >= 0; i--) {
            const ledGroup = document.createElement('div');
            ledGroup.className = 'led-group';
            const led = document.createElement('div');
            led.className = 'led';
            led.dataset.bit = i;
            const ledLabel = document.createElement('div');
            ledLabel.className = 'led-label';
            ledLabel.textContent = i;
            ledGroup.appendChild(led);
            ledGroup.appendChild(ledLabel);
            dataLedsContainer.appendChild(ledGroup);
            this.dataLeds[i] = led;
        }
    }

    attachEventListeners() {
        this.addressSwitches.forEach(switchElem => {
            switchElem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                switchElem.classList.toggle('up');
                switchElem.classList.toggle('down');
                this.altair.updateDisplay();
                this.playClickSound();
            });
        });

        this.dataSwitches.forEach(switchElem => {
            switchElem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                switchElem.classList.toggle('up');
                switchElem.classList.toggle('down');
                this.altair.updateDisplay();
                this.playClickSound();
            });
        });

        const buttons = [
            { id: 'reset-btn', handler: () => this.altair.reset() },
            { id: 'run-btn', handler: () => this.altair.run() },
            { id: 'stop-btn', handler: () => this.altair.stop() },
            { id: 'step-btn', handler: () => this.altair.step() },
            { id: 'examine-btn', handler: () => this.altair.examine() },
            { id: 'deposit-btn', handler: () => this.altair.deposit() },
            { id: 'load-basic-btn', handler: () => this.altair.loadBasic() }
        ];

        buttons.forEach(({ id, handler }) => {
            const btn = document.getElementById(id);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.style.transform = 'translateY(2px)';
                btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.5)';
                setTimeout(() => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
                }, 100);
                handler();
                this.playClickSound();
            });
        });

        const terminalInput = document.getElementById('terminal-input');
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const command = terminalInput.value.trim();
                terminalInput.value = '';
                if (this.altair.basicInterpreter.waitingForInput) {
                    this.altair.io.setInput(command + "\n", () => this.altair.basicInterpreter.executeNextLine());
                    this.altair.io.resolveInput();
                } else {
                    this.altair.handleTerminalInput(command);
                }
            }
        });
    }

    playClickSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnQGAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YU8GAACA//+A//+A//+A//+A//+A//+A//+A//+A//9/gH+Af4B/gH+Af4B/gH+Af4B/gH+A//+A//+A//+A//+A//+A//+A//+A//+A//+AAABhAH0AfgB+AH4AfgB+AH4AfwB/AH8AfwCAAIAAf///gP//gP//gP//gP//gP//gP//gP//gP7/gP7/gP3/gf3/gfz/gfv/gvr/g/n/g/j+hff+hvb+h/X+iPT9ifP9i/L9jPH8jvD8kO/8ku77lO37lu37mOz6mur6nOn6n+j5ouf5pOb5p+X4qeP4rOL3r+H3sd/2tN72t9z1utr1vdj0wNfzw9XyxtPxyNHwy87vzMzuz8rtz8jtzsbtzcTszMLsy8DrysHrysDqyb/qyb7pyb3pyLzpyLvpyLrpyLnpyLjpyLfpyLbpyLXpyLXqyLXqyLXqybbqybbqyLXqyLXqyLXqx7TqxrPqxbLqxLHqwq/qwa3qv6zqvqrqvKnquana+qva+qvZ+qvZ+qzZ+qzZ+qzZ+qzZ+qza+qza+q3a+q3a+q7a+q7a+q/a+q7a+q3a+qzZ+qvZ+qvZ+qrY+qrY+qrY+qrY+qrY+qrY+qrY+qvZ+qva+qzb+q3c+q7d+q/e+bDf+bHg+bLh+bPi+bTj+bXk+Lbl+Lfm+Ljo97np97rq97zs977s9r/t9sHu9sPv9sXx9sfy9snz9cv09s319s/29dH39dP39dX49dj59tr59t359t/69+H79+P79+X89+j8+On8+Or8+Oz9+O79+PD9+PL9+PP++fX++fb++vf++vn++vr++vz++/3/+/7/+/7/+/7//P///P///f///v////////////////////////////////////////////////////////////////////////+A//+A//+A//+A//+A//+A//+A//+A//+A//9/gH+Af4B/gH+Af4B/gH+Af4B/gH+A//+A//+A//+A//+A//+A//+A//+A//+A//+AAABhAH0AfgB+AH4AfgB+AH4AfwB/AH8AfwCAAIAAf///gP//gP//gP//gP//gP//gP//gP//gP7/gP7/gP3/gf3/gfz/gfv/gvr/g/n/g/j+hff+hvb+h/X+iPT9ifP9i/L9jPH8jvD8kO/8ku77lO37lu37mOz6mur6nOn6n+j5ouf5pOb5p+X4qeP4rOL3r+H3sd/2tN72t9z1utr1vdj0wNfzw9XyxtPxyNHwy87vzMzuz8rtz8jtzsbtzcTszMLsy8DrysHrysDqyb/qyb7pyb3pyLzpyLvpyLrpyLnpyLjpyLfpyLbpyLXpyLXqyLXqyLXqybbqybbqyLXqyLXqyLXqx7TqxrPqxbLqxLHqwq/qwa3qv6zqvqrqvKnquana+qva+qvZ+qvZ+qzZ+qzZ+qzZ+qzZ+qza+qza+q3a+q3a+q7a+q7a+q/a+q7a+q3a+qzZ+qvZ+qvZ+qrY+qrY+qrY+qrY+qrY+qrY+qrY+qvZ+qva+qzb+q3c+q7d+q/e+bDf+bHg+bLh+bPi+bTj+bXk+Lbl+Lfm+Ljo97np97rq97zs977s9r/t9sHu9sPv9sXx9sfy9snz9cv09s319s/29dH39dP39dX49dj59tr59t359t/69+H79+P79+X89+j8+On8+Or8+Oz9+O79+PD9+PL9+PP++fX++fb++vf++vn++vr++vz++/3/+/7/+/7/+/7//P///P///f///v////////////////////////////////////////////////////////////////////////8=');
        audio.volume = 0.2;
        audio.play().catch(() => {});
    }

    getAddressSwitchValue() {
        let value = 0;
        for (let i = 0; i < 16; i++) {
            if (this.addressSwitches[i].classList.contains('up')) {
                value |= (1 << i);
            }
        }
        return value;
    }

    getDataSwitchValue() {
        let value = 0;
        for (let i = 0; i < 8; i++) {
            if (this.dataSwitches[i].classList.contains('up')) {
                value |= (1 << i);
            }
        }
        return value;
    }

    setAddressLeds(value) {
        for (let i = 0; i < 16; i++) {
            this.addressLeds[i].classList.toggle('on', (value & (1 << i)) !== 0);
        }
    }

    setDataLeds(value) {
        for (let i = 0; i < 8; i++) {
            this.dataLeds[i].classList.toggle('on', (value & (1 << i)) !== 0);
        }
    }

    setStatusLeds(cpuState) {
        document.getElementById('led-inte').classList.toggle('on', cpuState.status.interruptsEnabled);
        document.getElementById('led-prot').classList.toggle('on', false);
        document.getElementById('led-hlta').classList.toggle('on', cpuState.status.halted);
        document.getElementById('led-out').classList.toggle('on', cpuState.status.output);
        document.getElementById('led-m1').classList.toggle('on', cpuState.status.m1);
        document.getElementById('led-inp').classList.toggle('on', cpuState.status.input);
        document.getElementById('led-memr').classList.toggle('on', cpuState.status.memRead);
        document.getElementById('led-wait').classList.toggle('on', cpuState.status.wait);
    }
}

// Main Altair Emulator
class Altair {
    constructor() {
        this.cpu = new Intel8080();
        this.memory = new Memory(65536);
        this.terminal = new Terminal(document.getElementById('terminal'));
        this.io = new IO(this.terminal);
        this.basicInterpreter = new BasicInterpreter(this.terminal, this.io);
        this.panel = new AltairPanel(this);
        this.running = false;
        this.runInterval = null;
        this.reset();
    }

    reset() {
        this.cpu.reset();
        this.memory.reset();
        this.running = false;
        if (this.runInterval) {
            clearInterval(this.runInterval);
            this.runInterval = null;
        }
        this.basicInterpreter.initialized = false;
        this.terminal.clear();
        document.getElementById('terminal-input').disabled = true;
        this.updateDisplay();
    }

    run() {
        if (!this.running) {
            this.running = true;
            document.getElementById('terminal-input').disabled = false;
            document.getElementById('terminal-input').focus();
            if (!this.basicInterpreter.initialized) {
                this.basicInterpreter.initialize();
            }
            this.runInterval = setInterval(() => {
                if (this.running) {
                    this.cpu.step(this.memory, this.io);
                    this.updateDisplay();
                }
            }, 10);
        }
    }

    stop() {
        this.running = false;
        if (this.runInterval) {
            clearInterval(this.runInterval);
            this.runInterval = null;
        }
        document.getElementById('terminal-input').disabled = true;
        this.updateDisplay();
    }

    step() {
        if (!this.running) {
            this.cpu.step(this.memory, this.io);
            this.updateDisplay();
        }
    }

    examine() {
        const address = this.panel.getAddressSwitchValue();
        const value = this.memory.read(address);
        this.panel.setAddressLeds(address);
        this.panel.setDataLeds(value);
    }

    deposit() {
        const address = this.panel.getAddressSwitchValue();
        const value = this.panel.getDataSwitchValue();
        this.memory.write(address, value);
        this.panel.setAddressLeds(address);
        this.panel.setDataLeds(value);
    }

    loadBasic() {
        this.terminal.clear();
        this.cpu.reset();
        this.memory.reset();
        this.memory.loadProgram(0, [0xC3, 0x00, 0x10]); // JMP 0x1000
        this.run();
    }

    handleTerminalInput(command) {
        this.terminal.println(command);
        this.basicInterpreter.executeCommand(command);
    }

    updateDisplay() {
        const cpuState = this.cpu.getState();
        this.panel.setAddressLeds(cpuState.pc);
        this.panel.setDataLeds(this.memory.read(cpuState.pc));
        this.panel.setStatusLeds(cpuState);
    }
}

// Initialize
window.onload = function() {
    const altair = new Altair();
    console.log("Altair 8800 emulator initialized");
};