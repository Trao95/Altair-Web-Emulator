// Wait for HTML to load
document.addEventListener('DOMContentLoaded', () => {

    // --- Get DOM Elements ---
    const panel = document.querySelector('.altair-panel');
    const lights = {};
    document.querySelectorAll('.light').forEach(light => lights[light.id] = light);
    const switches = {};
    document.querySelectorAll('.switch').forEach(sw => {
        switches[sw.id] = sw;
        if (!sw.classList.contains('momentary')) sw.classList.add('down');
        else sw.classList.add('up');
    });
    const terminalOutput = document.getElementById('terminal-output');
    const terminalInput = document.getElementById('terminal-input');
    const terminalSend = document.getElementById('terminal-send');

    // --- State Variables ---
    let powerState = false;

    // --- UI Functions ---
    function setLight(lightId, isOn) {
        const light = lights[lightId];
        if (light) {
            light.classList.toggle('on', isOn);
        }
    }

    // Update lights based on switches (simple demo)
    function updateLightsFromSwitches() {
        if (!powerState) return;
        for (let i = 0; i < 16; i++) {
            const sw = switches[`sw${i}`];
            const isUp = sw ? sw.classList.contains('up') : false;
            setLight(`light-a${i}`, isUp);
            if (i < 8) {
                setLight(`light-d${i}`, isUp);
            }
        }
    }

    // Toggle visual style for switches
    function toggleSwitchVisual(sw) {
        sw.classList.toggle('down');
        sw.classList.toggle('up');
    }

    // --- Switch Event Listeners ---
    for (const id in switches) {
        const sw = switches[id];
        // Toggle Switches
        if (!sw.classList.contains('momentary')) {
            sw.addEventListener('click', () => {
                if (!powerState && id !== 'sw-power') return;
                if (id === 'sw-power') {
                    handleCommand(id);
                } else {
                    toggleSwitchVisual(sw);
                    const switchIndex = sw.dataset.switchIndex;
                    const state = sw.classList.contains('up') ? 'UP (1)' : 'DOWN (0)';
                    console.log(`SWITCH ${switchIndex ?? id} toggled to ${state}`);
                    updateLightsFromSwitches();
                }
            });
        // Momentary Switches
        } else {
             sw.addEventListener('mousedown', () => {
                 if (!powerState) return;
                 sw.classList.add('pressed', 'down');
                 sw.classList.remove('up');
             });
             sw.addEventListener('mouseup', () => {
                 if (!powerState) return;
                 sw.classList.remove('pressed', 'down');
                 sw.classList.add('up');
                 handleCommand(sw.id);
             });
             sw.addEventListener('mouseleave', () => {
                 if (!powerState) return;
                  sw.classList.remove('pressed', 'down');
                  sw.classList.add('up');
            });
        }
    }

    // --- Handle Switch Commands ---
    function handleCommand(switchId) {
        switch (switchId) {
            // Handle Power
            case 'sw-power':
                 powerState = !powerState;
                 panel.classList.toggle('power-off', !powerState);
                 toggleSwitchVisual(switches['sw-power']);
                 console.log(`--- POWER ${powerState ? 'ON' : 'OFF'} ---`);
                 terminalInput.disabled = !powerState;
                 terminalSend.disabled = !powerState;
                 if (powerState) {
                     appendToTerminal("Calculator Ready.");
                     terminalInput.focus();
                     updateLightsFromSwitches();
                 } else {
                     appendToTerminal("Power OFF.");
                     document.querySelectorAll('.light').forEach(light => light.classList.remove('on'));
                 }
                 break;

            // Handle Stop/Run
            case 'sw-stop-run':
                if (!powerState) return;
                console.log("SWITCH: STOP/RUN activated");
                setLight('light-hlta', !lights['light-hlta']?.classList.contains('on'));
                break;

            // Handle Single Step
            case 'sw-single-step':
                 if (!powerState) return;
                console.log("SWITCH: SINGLE STEP activated");
                break;

            // Handle Examine
            case 'sw-examine':
                 if (!powerState) return;
                 console.log("SWITCH: EXAMINE activated");
                 let addressEx = 0;
                 for (let i = 0; i < 16; i++) {
                     if (switches[`sw${i}`]?.classList.contains('up')) addressEx |= (1 << i);
                 }
                 console.log(`(Demo) Examining Address: ${addressEx.toString(16).toUpperCase().padStart(4, '0')}`);
                 const dummyDataEx = addressEx % 256;
                 for (let i = 0; i < 8; i++) setLight(`light-d${i}`, (dummyDataEx & (1 << i)) !== 0);
                 break;

            // Handle Deposit
            case 'sw-deposit':
                 if (!powerState) return;
                 console.log("SWITCH: DEPOSIT activated");
                 let addressDep = 0;
                 let dataDep = 0;
                  for (let i = 0; i < 16; i++) if (switches[`sw${i}`]?.classList.contains('up')) addressDep |= (1 << i);
                   for (let i = 0; i < 8; i++) if (switches[`sw${i}`]?.classList.contains('up')) dataDep |= (1 << i);
                 console.log(`(Demo) Depositing Data ${dataDep.toString(16).toUpperCase().padStart(2, '0')} into Address: ${addressDep.toString(16).toUpperCase().padStart(4, '0')}`);
                 setLight('light-memr', true);
                 setTimeout(() => setLight('light-memr', false), 150);
                 break;

            // Handle Reset/Clear
            case 'sw-reset-clr':
                 if (!powerState) return;
                 console.log("SWITCH: RESET/CLR activated");
                 for (let i = 0; i < 16; i++) {
                      if(switches[`sw${i}`]) { switches[`sw${i}`].classList.remove('up'); switches[`sw${i}`].classList.add('down'); }
                 }
                 ['sw-protect', 'sw-aux1', 'sw-aux2'].forEach(id => {
                     if (switches[id]?.classList.contains('up')) toggleSwitchVisual(switches[id]);
                 });
                 updateLightsFromSwitches();
                 setLight('light-hlta', false);
                 console.log("(Demo) Sense/Address switches reset to 0");
                 appendToTerminal("Panel Reset.");
                 break;
        }
    }

    // --- Terminal Functions ---
    function appendToTerminal(text) {
        const needsNewline = terminalOutput.textContent.length > 0 && !terminalOutput.textContent.endsWith('\n');
        terminalOutput.textContent += (needsNewline ? '\n' : '') + text;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    function handleTerminalInput() {
        const inputText = terminalInput.value.trim();
        if (!inputText || !powerState) return;

        appendToTerminal(`> ${inputText}`);
        terminalInput.value = '';
        const command = inputText.toLowerCase();

        if (command === 'help') {
             appendToTerminal("COMMANDS: Enter math (e.g. 4*5+2), sqrt(number), 'clear', 'help'");
        } else if (command === 'clear') {
             const firstLine = terminalOutput.textContent.split('\n')[0];
             terminalOutput.textContent = firstLine.includes("Ready") ? firstLine : "Calculator Ready.";
        } else {
             try {
                const result = calculate(inputText); // Use original case for calc if needed
                appendToTerminal(`= ${result}`);
            } catch (error) {
                appendToTerminal(`ERROR: ${error.message}`);
            }
        }
         terminalInput.focus();
    }

    // --- Terminal Event Listeners ---
    terminalSend.addEventListener('click', handleTerminalInput);
    terminalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleTerminalInput();
        }
    });


    // --- Calculator Function ---
    function calculate(expression) {
        expression = expression.trim().toLowerCase();

        // Handle sqrt() - allow negative inside temporarily for error message
        const sqrtRegex = /sqrt\(\s*(-?\d*\.?\d+)\s*\)/g;
        expression = expression.replace(sqrtRegex, (match, numberStr) => {
            const number = parseFloat(numberStr);
            if (isNaN(number)) throw new Error(`Invalid number inside sqrt: '${numberStr}'`);
            if (number < 0) throw new Error("Cannot calculate square root of a negative number.");
            return Math.sqrt(number).toString(); // Use result directly
        });

        // Basic validation for remaining characters
        if (!/^[0-9\s\+\-\*\/e\.]+$/.test(expression)) {
             if (/^-?\d*\.?\d+(e[\+\-]?\d+)?$/.test(expression) && !isNaN(parseFloat(expression))) {
                 return Number(parseFloat(expression).toPrecision(12));
             }
            throw new Error("Invalid characters remain.");
        }

        // Normalize spacing and handle leading operator
        expression = expression.replace(/([\+\-\*\/])/g, ' $1 ').replace(/\s+/g, ' ').trim();
         if (expression.startsWith('+ ') || expression.startsWith('- ')) expression = '0 ' + expression;

        const tokens = expression.split(' ');
        if(tokens.length === 0 || (tokens.length === 1 && tokens[0] === '')) return 0;

        // Multiplication and Division Pass
        const pass1 = [];
        let i = 0;
        while (i < tokens.length) {
            const token = tokens[i];
            if ((token === '*' || token === '/') && pass1.length > 0 && !isNaN(parseFloat(pass1[pass1.length-1]))) {
                const left = parseFloat(pass1.pop());
                const right = parseFloat(tokens[i + 1]);
                if (isNaN(left) || isNaN(right)) throw new Error("Invalid number format near */.");
                if (token === '/' && right === 0) throw new Error("Division by zero.");
                pass1.push(token === '*' ? (left * right) : (left / right));
                i += 2;
            } else {
                if(!isNaN(parseFloat(token)) || token === '+' || token === '-') pass1.push(token);
                else if (token.trim() !== '') throw new Error(`Unexpected token: ${token}`);
                i += 1;
            }
        }

        // Addition and Subtraction Pass
        let result = parseFloat(pass1[0]);
        if (isNaN(result)) throw new Error("Invalid expression start.");
        i = 1;
        while (i < pass1.length) {
            const operator = pass1[i];
            const right = parseFloat(pass1[i + 1]);
            if (isNaN(right)) throw new Error("Invalid number format near +-.");
            if (operator !== '+' && operator !== '-') throw new Error(`Unexpected operator: ${operator}`);
            result = (operator === '+') ? (result + right) : (result - right);
            i += 2;
        }

        if (isNaN(result)) throw new Error("Calculation failed.");
        return Number(result.toPrecision(12));
    }

    // --- Initial Setup ---
    function initializePanel() {
         powerState = false;
         panel.classList.add('power-off');
         for (const id in switches) {
             const sw = switches[id];
             if (!sw.classList.contains('momentary')) { sw.classList.remove('up'); sw.classList.add('down'); }
             else { sw.classList.remove('down'); sw.classList.add('up'); }
         }
         terminalOutput.textContent = 'Power OFF. Turn ON to enable calculator.';
         terminalInput.value = '';
         terminalInput.disabled = true;
         terminalSend.disabled = true;
         document.querySelectorAll('.light').forEach(light => light.classList.remove('on'));
         console.log("Panel Initialized. Power is OFF.");
    }

    initializePanel(); // Run setup

}); // End DOMContentLoaded