import {
  connectPrinter,
  printImage,
  getBatteryLevel,
  isPrinterConnected,
  getLastKnownBatteryLevel,
} from "./printer.js";
import { renderReceipt, updateReceiptPreview } from "./receiptRenderer.js";
import { logger, setupLoggerUI } from "./logger.js";
import * as imageProcessor from "./imageProcessor.js";

// === DOM Elements ===
// These will be initialized in the init function to ensure they exist
let receiptModeBtn, imageModeBtn, receiptModeContent, imageModeContent;
let batteryIndicator, batteryLevel, batteryIcon;
let businessNameInput, businessAddressInput, businessPhoneInput;
let tableNumberInput,
  serverNameInput,
  transactionNumberInput,
  taxRateInput,
  dateTimeField;
let itemsListContainer, newItemNameInput, newItemPriceInput, addItemBtn;
let tipAmountInput, paymentMethodSelect, amountPaidInput, changeAmountDisplay;
let footerMessageInput, receiptBlocksContainer;
let connectReceiptBtn, printReceiptBtn, resetBtn;
let receiptPreview, receiptContainer, receiptSummary;

// Image Mode Elements
let imageUploadInput, ditherMethodSelect, thresholdValueInput, thresholdDisplay;
let imageInvertInput, imageWidthInput, autoscaleImageInput, imagePaddingInput;
let rotateLeftBtn, rotateRightBtn, rotationDisplay;
let connectImageBtn, resetImageBtn, printImageBtn;
let imagePreview, imagePreviewMessage, imageSummary;

// Logger UI elements
let logWrapper, clearLogBtn, printProgressBar;

// === Data Store ===
let items = [];
let currentDateTime = new Date().toLocaleString();
let currentMode = "receipt"; // 'receipt' or 'image'
let receiptBlockOrder = [
  "header",
  "transaction",
  "items",
  "totals",
  "payment",
  "footer",
];
let customBlocks = []; // Array to store custom blocks

// === Battery Level Timer ===
let batteryCheckIntervalId = null;
const BATTERY_CHECK_INTERVAL = 30000; // 30 seconds

// === Debounce Function ===
let updateReceiptViewTimeoutId = null;
const UPDATE_DEBOUNCE_DELAY = 300; // 300ms delay

// === Initialize ===
function init() {
  // Initialize DOM elements
  initDOMElements();

  updateDateTime();
  setInterval(updateDateTime, 60000); // Update time every minute
  renderItemsList();
  updateReceiptView();

  // Add event listeners for real-time updates
  const allReceiptInputs = document.querySelectorAll(
    "#receiptModeContent input, #receiptModeContent textarea, #receiptModeContent select",
  );
  allReceiptInputs.forEach((input) => {
    if (input) {
      input.addEventListener("input", updateReceiptView, { passive: true });
    }
  });

  // Initialize logger UI
  initLoggerUI();

  // Initialize mode toggle
  setupModeToggle();

  // Set up image mode listeners
  setupImageModeListeners();

  // Set up connect buttons
  setupConnectButtons();

  // Initialize print buttons (disabled by default)
  updatePrintButtonState();

  // Initialize receipt blocks
  renderReceiptBlocks();

  // Setup event listeners
  setupEventListeners();
}

// Initialize all DOM elements
function initDOMElements() {
  // Mode toggle
  receiptModeBtn = document.getElementById("receiptModeBtn");
  imageModeBtn = document.getElementById("imageModeBtn");
  receiptModeContent = document.getElementById("receiptModeContent");
  imageModeContent = document.getElementById("imageModeContent");

  // Battery indicator elements
  batteryIndicator = document.getElementById("batteryIndicator");
  batteryLevel = document.getElementById("batteryLevel");
  batteryIcon = document.querySelector(".battery-icon");

  // Receipt Mode Elements
  // Business info
  businessNameInput = document.getElementById("businessName");
  businessAddressInput = document.getElementById("businessAddress");
  businessPhoneInput = document.getElementById("businessPhone");
  // Transaction info
  tableNumberInput = document.getElementById("tableNumber");
  serverNameInput = document.getElementById("serverName");
  transactionNumberInput = document.getElementById("transactionNumber");
  taxRateInput = document.getElementById("taxRate");
  dateTimeField = document.getElementById("dateTimeField");
  // Items
  itemsListContainer = document.getElementById("itemsList");
  newItemNameInput = document.getElementById("newItemName");
  newItemPriceInput = document.getElementById("newItemPrice");
  addItemBtn = document.getElementById("addItemBtn");
  // Payment
  tipAmountInput = document.getElementById("tipAmount");
  paymentMethodSelect = document.getElementById("paymentMethod");
  amountPaidInput = document.getElementById("amountPaid");
  changeAmountDisplay = document.getElementById("changeAmount");
  // Footer
  footerMessageInput = document.getElementById("footerMessage");
  // Receipt Blocks
  receiptBlocksContainer = document.getElementById("receiptBlocksContainer");
  // Buttons
  connectReceiptBtn = document.getElementById("connectReceiptBtn");
  printReceiptBtn = document.getElementById("printReceiptBtn");
  resetBtn = document.getElementById("resetBtn");
  // Receipt preview
  receiptPreview = document.getElementById("receiptPreview");
  receiptContainer = document.getElementById("receiptContainer");
  receiptSummary = document.getElementById("receiptSummary");

  // Image Mode Elements
  imageUploadInput = document.getElementById("imageUpload");
  ditherMethodSelect = document.getElementById("ditherMethod");
  thresholdValueInput = document.getElementById("thresholdValue");
  thresholdDisplay = document.getElementById("thresholdDisplay");
  imageInvertInput = document.getElementById("imageInvert");
  imageWidthInput = document.getElementById("imageWidth");
  autoscaleImageInput = document.getElementById("autoscaleImage");
  imagePaddingInput = document.getElementById("imagePadding");
  rotateLeftBtn = document.getElementById("rotateLeftBtn");
  rotateRightBtn = document.getElementById("rotateRightBtn");
  rotationDisplay = document.getElementById("rotationDisplay");
  connectImageBtn = document.getElementById("connectImageBtn");
  resetImageBtn = document.getElementById("resetImageBtn");
  printImageBtn = document.getElementById("printImageBtn");
  imagePreview = document.getElementById("imagePreview");
  imagePreviewMessage = document.getElementById("imagePreviewMessage");
  imageSummary = document.getElementById("imageSummary");

  // Logger UI elements
  logWrapper = document.getElementById("logWrapper");
  clearLogBtn = document.getElementById("clearLogBtn");
  printProgressBar = document.getElementById("printProgressBar");
}

// Initialize the logger UI
function initLoggerUI() {
  // Set up the logger UI
  if (logWrapper && printProgressBar) {
    setupLoggerUI(logWrapper, printProgressBar);
  }

  // Add clear log button event listener
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      logger.clear();
      logger.info("Log cleared");
    });
  }

  // Add initial log entries
  logger.info("Printer Tool initialized");
  logger.info("Printer configuration", {
    printerWidth: 384,
    printerWidthBytes: 48,
    minDataBytes: 4320,
  });

  // Log detailed protocol information
  logger.data(
    "Printer Protocol",
    `MXW01 Thermal Printer Protocol Summary:

1. Connect via Bluetooth LE to service UUID: 0000ae30-0000-1000-8000-00805f9b34fb
2. Communication happens through three characteristics:
   - Control write: 0000ae01-0000-1000-8000-00805f9b34fb
   - Notification: 0000ae02-0000-1000-8000-00805f9b34fb
   - Data write: 0000ae03-0000-1000-8000-00805f9b34fb

3. Command format: 0x22 0x21 [CMD] 0x00 [LEN_L] [LEN_H] [PAYLOAD...] [CRC8] 0xFF
4. Print process:
   a. Set intensity (0xA2)
   b. Request status (0xA1)
   c. Send print request (0xA9)
   d. Transfer data in chunks
   e. Flush data (0xAD)
   f. Wait for print complete notification (0xAA)

5. Image encoding:
   - 1-bit monochrome (black/white)
   - 384 pixels wide (48 bytes)
   - Rows are sent sequentially
   - Image is rotated 180° before sending`,
  );
}

// Setup mode toggle functionality
function setupModeToggle() {
  if (!receiptModeBtn || !imageModeBtn) return;

  receiptModeBtn.addEventListener("click", () => {
    setActiveMode("receipt");
  });

  imageModeBtn.addEventListener("click", () => {
    setActiveMode("image");
  });

  // Initialize with receipt mode active
  setActiveMode("receipt");
}

// Set the active mode (receipt or image)
function setActiveMode(mode) {
  currentMode = mode;

  // Update button states
  if (receiptModeBtn && imageModeBtn) {
    receiptModeBtn.classList.toggle("active", mode === "receipt");
    imageModeBtn.classList.toggle("active", mode === "image");
  }

  // Update content visibility
  if (receiptModeContent && imageModeContent) {
    receiptModeContent.classList.toggle("active", mode === "receipt");
    imageModeContent.classList.toggle("active", mode === "image");
  }

  // Log mode change
  logger.info(`Switched to ${mode} mode`);

  // Update UI specific to the mode
  if (mode === "receipt") {
    updateReceiptView();
  } else {
    updateImagePreview();
  }

  // Change printing status style based on mode
  document.documentElement.style.setProperty(
    "--printing-status-color",
    mode === "receipt" ? "#3182ce" : "#c53030",
  );
}

// Setup image mode event listeners
function setupImageModeListeners() {
  // Skip if elements don't exist
  if (!imageUploadInput) return;

  // Image upload
  imageUploadInput.addEventListener("change", handleImageUpload);

  // Drag and Drop functionality
  setupDragAndDrop();

  // Dither method change
  if (ditherMethodSelect) {
    ditherMethodSelect.addEventListener("change", () => {
      imageProcessor.updateSettings({ ditherMethod: ditherMethodSelect.value });
      updateImagePreview();
    });
  }

  // Threshold value change
  if (thresholdValueInput && thresholdDisplay) {
    thresholdValueInput.addEventListener("input", () => {
      const threshold = parseInt(thresholdValueInput.value);
      thresholdDisplay.textContent = threshold;
      imageProcessor.updateSettings({ threshold });
      updateImagePreview();
    });
  }

  // Invert toggle
  if (imageInvertInput) {
    imageInvertInput.addEventListener("change", () => {
      imageProcessor.updateSettings({ invert: imageInvertInput.checked });
      updateImagePreview();
    });
  }

  // Width change
  if (imageWidthInput) {
    imageWidthInput.addEventListener("change", () => {
      let width = parseInt(imageWidthInput.value);
      if (width < 1) width = 1;
      if (width > 384) width = 384;
      imageWidthInput.value = width;
      imageProcessor.updateSettings({ width });
      updateImagePreview();
    });
  }

  // Auto-scale toggle
  if (autoscaleImageInput) {
    autoscaleImageInput.addEventListener("change", () => {
      imageProcessor.updateSettings({ autoscale: autoscaleImageInput.checked });
      updateImagePreview();
    });
  }

  // Padding change
  if (imagePaddingInput) {
    imagePaddingInput.addEventListener("change", () => {
      let padding = parseInt(imagePaddingInput.value);
      if (padding < 0) padding = 0;
      if (padding > 100) padding = 100;
      imagePaddingInput.value = padding;
      imageProcessor.updateSettings({ padding });
      updateImagePreview();
    });
  }

  // Rotate left button (counter-clockwise)
  if (rotateLeftBtn && rotationDisplay) {
    rotateLeftBtn.addEventListener("click", () => {
      const settings = imageProcessor.getSettings();
      // Calculate new rotation (0, 90, 180, 270) with wrap-around
      let newRotation = (settings.rotation - 90) % 360;
      if (newRotation < 0) newRotation += 360;

      imageProcessor.updateSettings({ rotation: newRotation });
      rotationDisplay.textContent = `${newRotation}°`;
      logger.info(`Image rotated to ${newRotation}°`);
      updateImagePreview();
    });
  }

  // Rotate right button (clockwise)
  if (rotateRightBtn && rotationDisplay) {
    rotateRightBtn.addEventListener("click", () => {
      const settings = imageProcessor.getSettings();
      // Calculate new rotation (0, 90, 180, 270) with wrap-around
      const newRotation = (settings.rotation + 90) % 360;

      imageProcessor.updateSettings({ rotation: newRotation });
      rotationDisplay.textContent = `${newRotation}°`;
      logger.info(`Image rotated to ${newRotation}°`);
      updateImagePreview();
    });
  }

  // Reset image settings
  if (resetImageBtn) {
    resetImageBtn.addEventListener("click", resetImageSettings);
  }

  // Print image
  if (printImageBtn) {
    printImageBtn.addEventListener("click", printProcessedImage);
  }
}

// === Drag and Drop Functionality ===
function setupDragAndDrop() {
  if (!imagePreview || !imagePreviewMessage) return;

  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  const dropMessage = document.getElementById("dropMessage");

  // Prevent the default behavior for these events to enable dropping
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Handle enter and over events
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, highlight, false);
  });

  // Handle leave and drop events
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });

  // Add and remove highlight class
  function highlight() {
    dropZone.classList.add("drag-over");
  }

  function unhighlight() {
    dropZone.classList.remove("drag-over");
  }

  // Handle the drop event
  dropZone.addEventListener("drop", handleDrop, false);

  async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      const file = files[0];

      // Check if the file is an image
      if (!file.type.match("image.*")) {
        logger.warn("File is not an image");
        imagePreviewMessage.textContent = "Error: Please upload an image file";
        return;
      }

      logger.info(`Processing dropped image: ${file.name}`, {
        type: file.type,
        size: `${Math.round(file.size / 1024)} KB`,
      });

      // Show loading state
      imagePreviewMessage.textContent = "Loading image...";
      imagePreview.style.display = "none";

      try {
        // Load the image
        await imageProcessor.loadImage(file);

        // Update the preview
        updateImagePreview();
      } catch (err) {
        logger.error("Error processing dropped image", {
          message: err.message,
        });
        imagePreviewMessage.textContent = `Error: ${err.message}`;
      }
    }
  }
}

// Handle image upload
async function handleImageUpload() {
  try {
    if (
      !imageUploadInput ||
      !imageUploadInput.files ||
      !imageUploadInput.files[0]
    ) {
      return;
    }

    const file = imageUploadInput.files[0];
    logger.info(`Processing uploaded image: ${file.name}`, {
      type: file.type,
      size: `${Math.round(file.size / 1024)} KB`,
    });

    // Show loading state
    if (imagePreviewMessage) {
      imagePreviewMessage.textContent = "Loading image...";
    }

    if (imagePreview) {
      imagePreview.style.display = "none";
    }

    // Load the image
    await imageProcessor.loadImage(file);

    // Update the preview
    updateImagePreview();
  } catch (err) {
    logger.error("Error uploading image", { message: err.message });
    if (imagePreviewMessage) {
      imagePreviewMessage.textContent = `Error: ${err.message}`;
    }
  }
}

// Update the image preview
function updateImagePreview() {
  if (!imagePreview || !imagePreviewMessage || !imageSummary) return;

  const canvas = imageProcessor.processImage();

  if (!canvas) {
    imagePreview.style.display = "none";
    imagePreviewMessage.style.display = "block";
    imagePreviewMessage.textContent =
      "Drop image here or click the upload button";
    imageSummary.innerHTML = "";
    return;
  }

  // Display processed image
  imagePreview.width = canvas.width;
  imagePreview.height = canvas.height;
  const ctx = imagePreview.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);

  imagePreview.style.display = "block";
  imagePreviewMessage.style.display = "none";

  // Update image summary
  updateImageSummary();
}

// Update the image summary panel
function updateImageSummary() {
  if (!imageSummary) return;

  const summary = imageProcessor.getImageSummary();
  if (!summary) {
    imageSummary.innerHTML = "";
    return;
  }

  imageSummary.innerHTML = `
    <div class="summary-section">
        <div class="summary-row">
            <span>Original Size:</span> <span>${summary.originalWidth} × ${summary.originalHeight} px</span>
        </div>
        <div class="summary-row">
            <span>Print Size:</span> <span>${summary.processedWidth} × ${summary.processedHeight} px</span>
        </div>
        <div class="summary-row">
            <span>Aspect Ratio:</span> <span>${summary.aspectRatio}</span>
        </div>
    </div>
    <div class="summary-section">
        <div class="summary-row">
            <span>Dithering:</span> <span>${summary.ditherMethod}</span>
        </div>
        <div class="summary-row">
            <span>Threshold:</span> <span>${summary.threshold}</span>
        </div>
        <div class="summary-row">
            <span>Inverted:</span> <span>${summary.invert ? "Yes" : "No"}</span>
        </div>
        <div class="summary-row">
            <span>Rotation:</span> <span>${summary.rotation}°</span>
        </div>
    </div>`;
}

// Reset image settings
function resetImageSettings() {
  const settings = imageProcessor.resetSettings();

  // Update UI to match reset settings
  if (ditherMethodSelect) {
    ditherMethodSelect.value = settings.ditherMethod;
  }

  if (thresholdValueInput) {
    thresholdValueInput.value = settings.threshold;
  }

  if (thresholdDisplay) {
    thresholdDisplay.textContent = settings.threshold;
  }

  if (imageInvertInput) {
    imageInvertInput.checked = settings.invert;
  }

  if (imageWidthInput) {
    imageWidthInput.value = settings.width;
  }

  if (autoscaleImageInput) {
    autoscaleImageInput.checked = settings.autoscale;
  }

  if (imagePaddingInput) {
    imagePaddingInput.value = settings.padding;
  }

  // Update preview
  updateImagePreview();
  logger.info("Image settings reset to defaults");
}

// Print the processed image
async function printProcessedImage() {
  const canvas = imageProcessor.processImage();

  if (!canvas) {
    logger.warn("No image to print");
    showPrintingStatus("No image to print", "error");
    setTimeout(() => hidePrintingStatus(), 3000);
    return;
  }

  try {
    // Check if printer is connected
    if (!isPrinterConnected()) {
      logger.warn("Printer not connected");
      showPrintingStatus("Please connect to printer first", "error");
      setTimeout(() => hidePrintingStatus(), 3000);
      return;
    }

    // Show printing status
    showPrintingStatus("Printing image...");

    // Log print job starting
    logger.info("Starting new print job");

    // Print the image
    await printImage(canvas);

    // Show success message
    showPrintingStatus("Image printed successfully!", "success");
    setTimeout(() => hidePrintingStatus(), 3000);
  } catch (err) {
    console.error("Print error:", err);
    logger.error("Print error", { message: err.message });
    showPrintingStatus(`Error: ${err.message}`, "error");
    setTimeout(() => hidePrintingStatus(), 5000);
  }
}

// === Connection and Battery Status ===
function setupConnectButtons() {
  // Add event listeners to both connect buttons
  if (connectReceiptBtn) {
    connectReceiptBtn.addEventListener("click", handleConnectPrinter);
  }

  if (connectImageBtn) {
    connectImageBtn.addEventListener("click", handleConnectPrinter);
  }
}

function updatePrintButtonState() {
  const connected = isPrinterConnected();

  // Update print buttons
  if (printReceiptBtn) {
    printReceiptBtn.disabled = !connected;

    if (connected) {
      printReceiptBtn.classList.remove("btn-secondary");
      printReceiptBtn.classList.add("btn-primary");
    } else {
      printReceiptBtn.classList.remove("btn-primary");
      printReceiptBtn.classList.add("btn-secondary");
    }
  }

  if (printImageBtn) {
    printImageBtn.disabled = !connected;

    if (connected) {
      printImageBtn.classList.remove("btn-secondary");
      printImageBtn.classList.add("btn-primary");
    } else {
      printImageBtn.classList.remove("btn-primary");
      printImageBtn.classList.add("btn-secondary");
    }
  }

  // Update connect buttons
  const buttonText = connected ? "Reconnect" : "Connect Printer";

  if (connectReceiptBtn) {
    connectReceiptBtn.textContent = buttonText;
  }

  if (connectImageBtn) {
    connectImageBtn.textContent = buttonText;
  }

  // Start or stop battery check based on connection status
  if (connected && !batteryCheckIntervalId) {
    startBatteryCheck();
  } else if (!connected && batteryCheckIntervalId) {
    stopBatteryCheck();
  }
}

async function handleConnectPrinter() {
  try {
    showPrintingStatus("Connecting to printer...");
    logger.info("Connecting to printer");
    await connectPrinter();

    // Update battery immediately after connection
    await updateBatteryStatus();

    // Start periodic battery check
    startBatteryCheck();

    // Update print button state
    updatePrintButtonState();

    showPrintingStatus("Printer connected successfully!", "success");
    setTimeout(() => hidePrintingStatus(), 3000);
  } catch (err) {
    console.error("Connection error:", err);
    logger.error("Connection error", { message: err.message });
    showPrintingStatus(`Error: ${err.message}`, "error");
    setTimeout(() => hidePrintingStatus(), 5000);
  }
}

function startBatteryCheck() {
  if (batteryCheckIntervalId) {
    clearInterval(batteryCheckIntervalId);
  }

  batteryCheckIntervalId = setInterval(async () => {
    if (isPrinterConnected()) {
      try {
        await updateBatteryStatus();
      } catch (error) {
        logger.warn("Failed to update battery status", {
          error: error.message,
        });
      }
    } else {
      stopBatteryCheck();
    }
  }, BATTERY_CHECK_INTERVAL);

  logger.debug("Battery check interval started", {
    intervalMs: BATTERY_CHECK_INTERVAL,
  });
}

function stopBatteryCheck() {
  if (batteryCheckIntervalId) {
    clearInterval(batteryCheckIntervalId);
    batteryCheckIntervalId = null;
    logger.debug("Battery check interval stopped");
  }
}

async function updateBatteryStatus() {
  try {
    let level;

    if (isPrinterConnected()) {
      // If connected, try to get fresh battery level
      level = await getBatteryLevel();
    } else {
      // If not connected, use last known level
      level = getLastKnownBatteryLevel();
    }

    if (level !== null) {
      updateBatteryIndicator(level);
    }
  } catch (error) {
    logger.warn("Error getting battery level", { message: error.message });
  }
}

function updateBatteryIndicator(level) {
  // Update the UI to display battery level
  if (level === null || !batteryIndicator || !batteryLevel || !batteryIcon) {
    if (batteryIndicator) {
      batteryIndicator.style.display = "none";
    }
    return;
  }

  batteryIndicator.style.display = "flex";

  // Show percentage
  batteryLevel.textContent = `${level}%`;

  // Set color based on level
  if (level < 20) {
    batteryLevel.className = "battery-level low";
    batteryIcon.innerHTML = "🔋";
  } else if (level < 50) {
    batteryLevel.className = "battery-level medium";
    batteryIcon.innerHTML = "🔋";
  } else {
    batteryLevel.className = "battery-level high";
    batteryIcon.innerHTML = "🔋";
  }

  logger.debug("Battery indicator updated", { level });
}

// === Item Management ===
function addItem() {
  const nameInput = document.getElementById("newItemName");
  const priceInput = document.getElementById("newItemPrice");

  if (!nameInput || !priceInput) return;

  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value) || 0;

  if (name) {
    items.push({ name, price });
    nameInput.value = "";
    priceInput.value = "";
    nameInput.focus();
    renderItemsList();
    updateReceiptView();
  }
}

function deleteItem(index) {
  items.splice(index, 1);
  renderItemsList();
  updateReceiptView();
}

function renderItemsList() {
  // Make sure the container exists
  const container = document.getElementById("itemsList");
  if (!container) return;

  container.innerHTML = "";

  items.forEach((item, index) => {
    const itemRow = document.createElement("div");
    itemRow.className = "item-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = item.name;

    const priceSpan = document.createElement("span");
    priceSpan.className = "item-price";
    priceSpan.textContent = `$${item.price.toFixed(2)}`;

    const deleteBtn = document.createElement("span");
    deleteBtn.className = "item-delete";
    deleteBtn.textContent = "×";
    deleteBtn.onclick = () => deleteItem(index);

    itemRow.appendChild(nameSpan);
    itemRow.appendChild(priceSpan);
    itemRow.appendChild(deleteBtn);

    container.appendChild(itemRow);
  });
}

// === Calculations ===
function calculateTotals() {
  // Get the current values from the DOM
  const currentTaxRateInput = document.getElementById("taxRate");
  const currentTipAmountInput = document.getElementById("tipAmount");
  const currentAmountPaidInput = document.getElementById("amountPaid");
  const currentChangeAmountDisplay = document.getElementById("changeAmount");

  // Calculate subtotal from items
  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.price || 0),
    0,
  );
  const taxRate = currentTaxRateInput
    ? parseFloat(currentTaxRateInput.value) || 0
    : 0;
  const tax = subtotal * (taxRate / 100);
  const tip = currentTipAmountInput
    ? parseFloat(currentTipAmountInput.value) || 0
    : 0;
  const total = subtotal + tax + tip;
  const amountPaid = currentAmountPaidInput
    ? parseFloat(currentAmountPaidInput.value) || 0
    : 0;
  const change = Math.max(0, amountPaid - total);

  // Update change display
  if (currentChangeAmountDisplay) {
    currentChangeAmountDisplay.textContent = `$${change.toFixed(2)}`;
  }

  return { subtotal, tax, tip, total, change };
}

function updateDateTime() {
  currentDateTime = new Date().toLocaleString();
  if (dateTimeField) {
    dateTimeField.textContent = currentDateTime;
  }
  updateReceiptView(); // Refresh receipt preview with new time
}

// === Receipt Management ===
function getReceiptData() {
  calculateTotals(); // Make sure calculations are up to date

  // Get the current values from the DOM
  const currentBusinessNameInput = document.getElementById("businessName");
  const currentBusinessAddressInput =
    document.getElementById("businessAddress");
  const currentBusinessPhoneInput = document.getElementById("businessPhone");
  const currentTableNumberInput = document.getElementById("tableNumber");
  const currentServerNameInput = document.getElementById("serverName");
  const currentTransactionNumberInput =
    document.getElementById("transactionNumber");
  const currentTaxRateInput = document.getElementById("taxRate");
  const currentTipAmountInput = document.getElementById("tipAmount");
  const currentPaymentMethodSelect = document.getElementById("paymentMethod");
  const currentAmountPaidInput = document.getElementById("amountPaid");
  const currentFooterMessageInput = document.getElementById("footerMessage");

  return {
    businessName: currentBusinessNameInput
      ? currentBusinessNameInput.value
      : "MY RESTAURANT",
    businessAddress: currentBusinessAddressInput
      ? currentBusinessAddressInput.value
      : "123 MAIN STREET\nCITY, STATE 12345",
    businessPhone: currentBusinessPhoneInput
      ? currentBusinessPhoneInput.value
      : "(555) 123-4567",
    tableNumber: currentTableNumberInput ? currentTableNumberInput.value : "12",
    serverName: currentServerNameInput ? currentServerNameInput.value : "ALICE",
    transactionNumber: currentTransactionNumberInput
      ? currentTransactionNumberInput.value
      : "1234",
    taxRate: currentTaxRateInput
      ? parseFloat(currentTaxRateInput.value) || 0
      : 0,
    dateTime: currentDateTime,
    tipAmount: currentTipAmountInput
      ? parseFloat(currentTipAmountInput.value) || 0
      : 0,
    paymentMethod: currentPaymentMethodSelect
      ? currentPaymentMethodSelect.value
      : "CREDIT",
    amountPaid: currentAmountPaidInput
      ? parseFloat(currentAmountPaidInput.value) || 0
      : 0,
    footerMessage: currentFooterMessageInput
      ? currentFooterMessageInput.value
      : "THANK YOU FOR DINING WITH US\nPLEASE COME AGAIN\nWWW.MYRESTAURANT.COM",
    blockOrder: receiptBlockOrder,
    customBlocks: customBlocks,
  };
}

function updateReceiptView() {
  // Clear any pending updates
  if (updateReceiptViewTimeoutId) {
    clearTimeout(updateReceiptViewTimeoutId);
  }

  // Schedule a new update
  updateReceiptViewTimeoutId = setTimeout(() => {
    const receiptData = getReceiptData();
    showBitmapPreview(receiptData, items);
    updateReceiptSummary();
    updateReceiptViewTimeoutId = null;
  }, UPDATE_DEBOUNCE_DELAY);
}

// Updated function for a preview that fits on screen
async function showBitmapPreview(receiptData, items) {
  const canvas = await renderReceipt(receiptData, items);
  const previewContainer = document.getElementById("receiptPreview");

  if (!previewContainer) return;

  // Clear current preview
  previewContainer.innerHTML = "";

  // Set up canvas for display
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.imageRendering = "pixelated";
  canvas.style.display = "block";

  previewContainer.appendChild(canvas);
}

// Create a detailed but compact receipt summary panel
function updateReceiptSummary() {
  if (!receiptSummary) return;

  const { subtotal, tax, tip, total, change } = calculateTotals();
  const receiptData = getReceiptData();

  receiptSummary.innerHTML = `
    <div class="summary-section">
        <div class="summary-row">
            <span>Items:</span> <span>${items.length}</span>
        </div>
        <div class="summary-row">
            <span>Server:</span> <span>${receiptData.serverName}</span>
        </div>
        <div class="summary-row">
            <span>Table:</span> <span>${receiptData.tableNumber}</span>
        </div>
    </div>
    <div class="summary-section">
        <div class="summary-row">
            <span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Tax:</span> <span>$${tax.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Tip:</span> <span>$${tip.toFixed(2)}</span>
        </div>
        <div class="summary-row summary-total">
            <span>Total:</span> <span>$${total.toFixed(2)}</span>
        </div>
    </div>
    <div class="summary-section">
        <div class="summary-row">
            <span>${receiptData.paymentMethod}:</span> <span>$${receiptData.amountPaid.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Change:</span> <span>$${change.toFixed(2)}</span>
        </div>
    </div>`;
}

function resetForm() {
  // Confirm before resetting
  if (
    confirm(
      "Reset all receipt data? This will clear all items and reset to default values.",
    )
  ) {
    items = [];

    // Reset to default values
    businessNameInput.value = "MY RESTAURANT";
    businessAddressInput.value = "123 MAIN STREET\nCITY, STATE 12345";
    businessPhoneInput.value = "(555) 123-4567";
    tableNumberInput.value = "12";
    serverNameInput.value = "ALICE";
    transactionNumberInput.value = "1234";
    taxRateInput.value = "8.25";
    tipAmountInput.value = "0.00";
    paymentMethodSelect.value = "CREDIT";
    amountPaidInput.value = "0.00";
    footerMessageInput.value =
      "THANK YOU FOR DINING WITH US\nPLEASE COME AGAIN\nWWW.MYRESTAURANT.COM";

    // Reset block order to default
    receiptBlockOrder = [
      "header",
      "transaction",
      "items",
      "totals",
      "payment",
      "footer",
    ];

    // Clear custom blocks
    customBlocks = [];

    renderItemsList();
    renderReceiptBlocks();
    updateReceiptView();

    logger.info("Receipt form reset to defaults");
  }
}

// === Receipt Block Management ===
function renderReceiptBlocks() {
  // Check if container exists
  if (!receiptBlocksContainer) return;

  // Clear the container
  receiptBlocksContainer.innerHTML = "";

  // Block name mapping for display
  const blockNames = {
    header: "Business Header",
    transaction: "Transaction Info",
    items: "Items List",
    totals: "Subtotal & Tax",
    payment: "Payment Info",
    footer: "Footer Message",
  };

  // Add "Add New Block" button at the top
  const addBlockContainer = document.createElement("div");
  addBlockContainer.className = "add-block-container";

  const addBlockBtn = document.createElement("button");
  addBlockBtn.className = "btn-primary add-block-btn";
  addBlockBtn.textContent = "+ Add Block";
  addBlockBtn.addEventListener("click", showAddBlockModal);

  addBlockContainer.appendChild(addBlockBtn);
  receiptBlocksContainer.appendChild(addBlockContainer);

  // Create blocks based on current order
  receiptBlockOrder.forEach((blockType, index) => {
    const blockElement = document.createElement("div");
    blockElement.className = "receipt-block";
    blockElement.dataset.blockType = blockType;
    blockElement.draggable = true;

    // Add drag event listeners
    blockElement.addEventListener("dragstart", handleDragStart);
    blockElement.addEventListener("dragover", handleDragOver);
    blockElement.addEventListener("dragenter", handleDragEnter);
    blockElement.addEventListener("dragleave", handleDragLeave);
    blockElement.addEventListener("dragend", handleDragEnd);
    blockElement.addEventListener("drop", handleDrop);

    // Create block header
    const blockHeader = document.createElement("div");
    blockHeader.className = "receipt-block-header";

    // Block title
    const titleSpan = document.createElement("span");
    titleSpan.className = "receipt-block-title";

    // Determine block name
    let blockName = "";
    if (blockType.startsWith("custom_")) {
      const customBlockId = blockType.replace("custom_", "");
      const customBlock = customBlocks.find(
        (block) => block.id === customBlockId,
      );
      blockName = customBlock ? customBlock.title : "Custom Block";
    } else if (blockType.startsWith("divider_")) {
      blockName = "Divider Line";
    } else {
      blockName = blockNames[blockType] || blockType;
    }

    titleSpan.textContent = blockName;

    // Controls
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "receipt-block-controls";

    // Move up button
    const moveUpBtn = document.createElement("button");
    moveUpBtn.className = "receipt-block-btn move-up";
    moveUpBtn.innerHTML = "↑";
    moveUpBtn.title = "Move Up";
    moveUpBtn.disabled = index === 0;
    moveUpBtn.classList.toggle("disabled", index === 0);
    moveUpBtn.addEventListener("click", () => moveBlockUp(index));

    // Move down button
    const moveDownBtn = document.createElement("button");
    moveDownBtn.className = "receipt-block-btn move-down";
    moveDownBtn.innerHTML = "↓";
    moveDownBtn.title = "Move Down";
    moveDownBtn.disabled = index === receiptBlockOrder.length - 1;
    moveDownBtn.classList.toggle(
      "disabled",
      index === receiptBlockOrder.length - 1,
    );
    moveDownBtn.addEventListener("click", () => moveBlockDown(index));

    // Edit button for custom blocks
    if (blockType.startsWith("custom_")) {
      const editBtn = document.createElement("button");
      editBtn.className = "receipt-block-btn edit";
      editBtn.innerHTML = "✎";
      editBtn.title = "Edit Block";
      editBtn.addEventListener("click", () => editCustomBlock(blockType));
      controlsDiv.appendChild(editBtn);
    }

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "receipt-block-btn delete";
    deleteBtn.innerHTML = "×";
    deleteBtn.title = "Delete Block";
    deleteBtn.addEventListener("click", () => deleteBlock(index));

    // Add controls to the header
    controlsDiv.appendChild(moveUpBtn);
    controlsDiv.appendChild(moveDownBtn);
    controlsDiv.appendChild(deleteBtn);

    // Assemble the header
    blockHeader.appendChild(titleSpan);
    blockHeader.appendChild(controlsDiv);

    // Create block content
    const blockContent = document.createElement("div");
    blockContent.className = "receipt-block-content";

    // Add appropriate content based on block type
    if (blockType.startsWith("divider_")) {
      // Divider block has no editable content
      blockContent.innerHTML = `
                <div class="divider-preview">
                    <hr class="receipt-divider-preview" />
                    <div class="info-text">
                        This block displays a divider line on the receipt.
                    </div>
                </div>
            `;
    } else {
      switch (blockType) {
        case "header":
          blockContent.innerHTML = `
                    <div class="input-group">
                        <label for="businessName">Name</label>
                        <input type="text" id="businessName" value="MY RESTAURANT" />
                    </div>
                    <div class="input-group">
                        <label for="businessAddress">Address</label>
                        <textarea id="businessAddress" rows="2">123 MAIN STREET
CITY, STATE 12345</textarea>
                    </div>
                    <div class="input-group">
                        <label for="businessPhone">Phone</label>
                        <input type="text" id="businessPhone" value="(555) 123-4567" />
                    </div>
                `;
          break;

        case "transaction":
          blockContent.innerHTML = `
                    <div class="flex-row">
                        <div class="input-group">
                            <label for="tableNumber">Table</label>
                            <input type="text" id="tableNumber" value="12" />
                        </div>
                        <div class="input-group">
                            <label for="serverName">Server</label>
                            <input type="text" id="serverName" value="ALICE" />
                        </div>
                        <div class="input-group">
                            <label for="transactionNumber">#</label>
                            <input type="text" id="transactionNumber" value="1234" />
                        </div>
                    </div>
                    <div class="flex-row">
                        <div class="input-group">
                            <label for="taxRate">Tax %</label>
                            <input type="number" id="taxRate" value="8.25" step="0.01" />
                        </div>
                        <div class="input-group">
                            <label>Date/Time</label>
                            <div class="read-only-field" id="dateTimeField"></div>
                        </div>
                    </div>
                `;
          break;

        case "items":
          blockContent.innerHTML = `
                    <div id="itemsList"></div>
                    <div class="item-entry">
                        <div class="flex-row">
                            <div class="input-group">
                                <input type="text" id="newItemName" placeholder="Item name" />
                            </div>
                            <div class="input-group input-group-small">
                                <input type="number" id="newItemPrice" placeholder="0.00" step="0.01" />
                            </div>
                            <button id="addItemBtn" class="btn-primary">Add</button>
                        </div>
                    </div>
                `;
          break;

        case "totals":
          // No inputs needed for totals, they're calculated automatically
          blockContent.innerHTML = `
                    <div class="info-text">
                        Subtotal, tax, and total are calculated automatically based on items and tax rate.
                    </div>
                `;
          break;

        case "payment":
          blockContent.innerHTML = `
                    <div class="flex-row">
                        <div class="input-group">
                            <label for="tipAmount">Tip</label>
                            <input type="number" id="tipAmount" value="0.00" step="0.01" />
                        </div>
                        <div class="input-group">
                            <label for="paymentMethod">Method</label>
                            <select id="paymentMethod">
                                <option value="CASH">Cash</option>
                                <option value="CREDIT" selected>Credit Card</option>
                                <option value="DEBIT">Debit</option>
                                <option value="MOBILE">Mobile Pay</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex-row">
                        <div class="input-group">
                            <label for="amountPaid">Paid</label>
                            <input type="number" id="amountPaid" value="0.00" step="0.01" />
                        </div>
                        <div class="input-group">
                            <label>Change</label>
                            <div class="read-only-field" id="changeAmount">$0.00</div>
                        </div>
                    </div>
                `;
          break;

        case "footer":
          blockContent.innerHTML = `
                    <div class="input-group">
                        <label for="footerMessage">Footer Message</label>
                        <textarea id="footerMessage" rows="3">THANK YOU FOR DINING WITH US
PLEASE COME AGAIN
WWW.MYRESTAURANT.COM</textarea>
                    </div>
                `;
          break;

        default:
          // Custom block or divider
          if (blockType.startsWith("custom_")) {
            const customBlockId = blockType.replace("custom_", "");
            const customBlock = customBlocks.find(
              (block) => block.id === customBlockId,
            );

            if (customBlock) {
              blockContent.innerHTML = `
                            <div class="input-group">
                                <label>Content</label>
                                <textarea class="custom-block-content" rows="3" data-block-id="${customBlockId}">${customBlock.content || ""}</textarea>
                            </div>
                            <div class="flex-row">
                                <div class="input-group">
                                    <label>Alignment</label>
                                    <select class="custom-block-alignment" data-block-id="${customBlockId}">
                                        <option value="left" ${customBlock.contentAlignment === "left" ? "selected" : ""}>Left</option>
                                        <option value="center" ${customBlock.contentAlignment === "center" ? "selected" : ""}>Center</option>
                                        <option value="right" ${customBlock.contentAlignment === "right" ? "selected" : ""}>Right</option>
                                    </select>
                                </div>
                            </div>
                        `;

              // Add event listeners for custom block inputs
              setTimeout(() => {
                const contentInput = blockContent.querySelector(
                  `.custom-block-content[data-block-id="${customBlockId}"]`,
                );
                const alignmentSelect = blockContent.querySelector(
                  `.custom-block-alignment[data-block-id="${customBlockId}"]`,
                );

                if (contentInput) {
                  contentInput.addEventListener("input", () => {
                    updateCustomBlockContent(customBlockId, contentInput.value);
                  });
                }

                if (alignmentSelect) {
                  alignmentSelect.addEventListener("change", () => {
                    updateCustomBlockAlignment(
                      customBlockId,
                      alignmentSelect.value,
                    );
                  });
                }
              }, 0);
            }
          } else if (blockType.startsWith("divider_")) {
            // Divider block has no editable content
            // This is now handled outside the switch statement
          }
          break;
      }

      // Assemble the block
      blockElement.appendChild(blockHeader);
      blockElement.appendChild(blockContent);

      // Add to container
      receiptBlocksContainer.appendChild(blockElement);
    }
  });

  // Re-attach event listeners for inputs
  setTimeout(() => {
    // Business info
    const businessNameInput = document.getElementById("businessName");
    const businessAddressInput = document.getElementById("businessAddress");
    const businessPhoneInput = document.getElementById("businessPhone");
    // Transaction info
    const tableNumberInput = document.getElementById("tableNumber");
    const serverNameInput = document.getElementById("serverName");
    const transactionNumberInput = document.getElementById("transactionNumber");
    const taxRateInput = document.getElementById("taxRate");
    const dateTimeField = document.getElementById("dateTimeField");
    // Items
    const newItemNameInput = document.getElementById("newItemName");
    const newItemPriceInput = document.getElementById("newItemPrice");
    const addItemBtn = document.getElementById("addItemBtn");
    // Payment
    const tipAmountInput = document.getElementById("tipAmount");
    const paymentMethodSelect = document.getElementById("paymentMethod");
    const amountPaidInput = document.getElementById("amountPaid");
    // Footer
    const footerMessageInput = document.getElementById("footerMessage");

    // Add event listeners
    const allInputs = document.querySelectorAll(
      "#receiptBlocksContainer input, #receiptBlocksContainer textarea, #receiptBlocksContainer select",
    );
    allInputs.forEach((input) => {
      // Add event listeners to all inputs, including custom block inputs
      input.addEventListener("input", updateReceiptView, { passive: true });

      // For select elements, also add change event
      if (input.tagName.toLowerCase() === "select") {
        input.addEventListener("change", updateReceiptView, { passive: true });
      }

      // Special handling for custom block inputs
      if (input.classList.contains("custom-block-content")) {
        const blockId = input.dataset.blockId;
        input.addEventListener(
          "input",
          () => {
            updateCustomBlockContent(blockId, input.value);
            // No need to call updateReceiptView again as the input event already triggered it
          },
          { passive: true },
        );
      } else if (input.classList.contains("custom-block-alignment")) {
        const blockId = input.dataset.blockId;
        input.addEventListener(
          "change",
          () => {
            updateCustomBlockAlignment(blockId, input.value);
            // No need to call updateReceiptView again as the change event already triggered it
          },
          { passive: true },
        );
      } else if (input.classList.contains("custom-block-divider")) {
        const blockId = input.dataset.blockId;
        input.addEventListener(
          "change",
          () => {
            updateCustomBlockDivider(blockId, input.checked);
            // No need to call updateReceiptView again as the change event already triggered it
          },
          { passive: true },
        );
      }
    });

    // Special handling for items
    if (addItemBtn) {
      addItemBtn.addEventListener("click", addItem);

      if (newItemNameInput) {
        newItemNameInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            addItem();
            if (newItemPriceInput) {
              newItemPriceInput.focus();
            }
          }
        });
      }

      if (newItemPriceInput) {
        newItemPriceInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") addItem();
        });
      }
    }

    // Render items list
    renderItemsList();

    // Update date/time field
    if (dateTimeField) {
      dateTimeField.textContent = currentDateTime;
    }
  }, 100); // Increased timeout to ensure DOM is ready
}

function moveBlockUp(index) {
  if (index <= 0) return; // Already at the top

  // Swap with the block above
  [receiptBlockOrder[index], receiptBlockOrder[index - 1]] = [
    receiptBlockOrder[index - 1],
    receiptBlockOrder[index],
  ];

  // Re-render blocks and update receipt
  renderReceiptBlocks();
  updateReceiptView();

  logger.info(`Moved block "${receiptBlockOrder[index - 1]}" up`);
}

function moveBlockDown(index) {
  if (index >= receiptBlockOrder.length - 1) return; // Already at the bottom

  // Swap with the block below
  [receiptBlockOrder[index], receiptBlockOrder[index + 1]] = [
    receiptBlockOrder[index + 1],
    receiptBlockOrder[index],
  ];

  // Re-render blocks and update receipt
  renderReceiptBlocks();
  updateReceiptView();

  logger.info(`Moved block "${receiptBlockOrder[index + 1]}" down`);
}

function deleteBlock(index) {
  const blockType = receiptBlockOrder[index];

  // Don't allow deleting all blocks
  if (receiptBlockOrder.length <= 1) {
    alert("Cannot delete the last block. At least one block is required.");
    return;
  }

  // Confirm deletion
  if (confirm(`Are you sure you want to delete the "${blockType}" block?`)) {
    // If it's a custom block, remove it from customBlocks array
    if (blockType.startsWith("custom_")) {
      const customBlockId = blockType.replace("custom_", "");
      const customBlockIndex = customBlocks.findIndex(
        (block) => block.id === customBlockId,
      );

      if (customBlockIndex !== -1) {
        customBlocks.splice(customBlockIndex, 1);
      }
    }

    // Remove from block order
    receiptBlockOrder.splice(index, 1);

    // Re-render blocks and update receipt
    renderReceiptBlocks();
    updateReceiptView();

    logger.info(`Deleted block "${blockType}"`);
  }
}

// Drag and drop functionality for receipt blocks
let draggedBlock = null;

function handleDragStart(e) {
  draggedBlock = this;
  this.classList.add("dragging");

  // Set data for drag operation
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.blockType);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Allow drop
  }
  e.dataTransfer.dropEffect = "move";
  return false;
}

function handleDragEnter(e) {
  this.classList.add("drag-over");
}

function handleDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleDragEnd(e) {
  // Clean up
  this.classList.remove("dragging");

  // Remove drag-over class from all blocks
  document.querySelectorAll(".receipt-block").forEach((block) => {
    block.classList.remove("drag-over");
  });
}

function handleDrop(e) {
  e.stopPropagation(); // Stop bubbling
  e.preventDefault();

  // Only proceed if we're dropping onto another block
  if (draggedBlock !== this) {
    // Get the indices of the source and target blocks
    const blocks = Array.from(
      receiptBlocksContainer.querySelectorAll(".receipt-block"),
    );
    const sourceIndex = blocks.indexOf(draggedBlock);
    const targetIndex = blocks.indexOf(this);

    // Get the block type being moved
    const blockType = draggedBlock.dataset.blockType;

    // Remove the block from its original position
    receiptBlockOrder.splice(sourceIndex, 1);

    // Insert it at the new position
    receiptBlockOrder.splice(targetIndex, 0, blockType);

    // Re-render blocks and update receipt
    renderReceiptBlocks();
    updateReceiptView();

    logger.info(
      `Reordered receipt blocks: moved "${blockType}" to position ${targetIndex + 1}`,
    );
  }

  this.classList.remove("drag-over");
  return false;
}

// Custom block management
function showAddBlockModal() {
  // Create modal container
  const modalContainer = document.createElement("div");
  modalContainer.className = "modal-container";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  // Create modal header
  const modalHeader = document.createElement("div");
  modalHeader.className = "modal-header";

  const modalTitle = document.createElement("h3");
  modalTitle.textContent = "Add Block";

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => {
    document.body.removeChild(modalContainer);
  });

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Create modal body
  const modalBody = document.createElement("div");
  modalBody.className = "modal-body";

  // Add block type selection
  modalBody.innerHTML = `
        <div class="input-group">
            <label for="blockTypeSelect">Block Type</label>
            <select id="blockTypeSelect">
                <option value="custom" selected>Custom Block</option>
                <option value="header">Business Header</option>
                <option value="transaction">Transaction Info</option>
                <option value="items">Items List</option>
                <option value="totals">Subtotal & Tax</option>
                <option value="payment">Payment Info</option>
                <option value="footer">Footer Message</option>
                <option value="divider">Divider Line</option>
            </select>
        </div>
        <div id="customBlockFields">
            <div class="input-group">
                <label for="customBlockTitle">Block Title</label>
                <input type="text" id="customBlockTitle" placeholder="Enter block title" />
            </div>
            <div class="input-group">
                <label for="customBlockContent">Content</label>
                <textarea id="customBlockContent" rows="4" placeholder="Enter block content"></textarea>
            </div>
            <div class="flex-row">
                <div class="input-group">
                    <label for="customBlockTitleAlignment">Title Alignment</label>
                    <select id="customBlockTitleAlignment">
                        <option value="left">Left</option>
                        <option value="center" selected>Center</option>
                        <option value="right">Right</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="customBlockContentAlignment">Content Alignment</label>
                    <select id="customBlockContentAlignment">
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                    </select>
                </div>
            </div>
        </div>
    `;

  // Create modal footer
  const modalFooter = document.createElement("div");
  modalFooter.className = "modal-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(modalContainer);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-primary";
  addBtn.textContent = "Add Block";
  addBtn.addEventListener("click", () => {
    const blockType = document.getElementById("blockTypeSelect").value;

    if (blockType === "custom") {
      const title =
        document.getElementById("customBlockTitle").value.trim() ||
        "Custom Block";
      const content = document.getElementById("customBlockContent").value;
      const titleAlignment = document.getElementById(
        "customBlockTitleAlignment",
      ).value;
      const contentAlignment = document.getElementById(
        "customBlockContentAlignment",
      ).value;

      addCustomBlock(title, content, titleAlignment, contentAlignment);
    } else if (blockType === "divider") {
      addDividerBlock();
    } else {
      // Add standard block type
      addStandardBlock(blockType);
    }

    document.body.removeChild(modalContainer);
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(addBtn);

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modalContainer.appendChild(modalContent);

  // Add to body
  document.body.appendChild(modalContainer);

  // Add event listener to toggle custom block fields
  const blockTypeSelect = document.getElementById("blockTypeSelect");
  const customBlockFields = document.getElementById("customBlockFields");

  blockTypeSelect.addEventListener("change", () => {
    if (blockTypeSelect.value === "custom") {
      customBlockFields.style.display = "block";
    } else {
      customBlockFields.style.display = "none";
    }
  });
}

function addCustomBlock(title, content, titleAlignment, contentAlignment) {
  // Generate unique ID
  const blockId = "custom_" + Date.now();

  // Create custom block object
  const customBlock = {
    id: blockId.replace("custom_", ""),
    title,
    content,
    titleAlignment,
    contentAlignment,
  };

  // Add to custom blocks array
  customBlocks.push(customBlock);

  // Add to block order
  receiptBlockOrder.push(blockId);

  // Re-render blocks and update receipt
  renderReceiptBlocks();
  updateReceiptView();

  logger.info(`Added custom block "${title}"`);
}

// Add a divider block to the receipt
function addDividerBlock() {
  // Generate unique ID
  const blockId = "divider_" + Date.now();
  const dividerIdOnly = blockId.replace("divider_", "");

  // Create divider block object
  const dividerBlock = {
    id: dividerIdOnly,
    type: "divider",
  };

  // Add to custom blocks array
  customBlocks.push(dividerBlock);

  // Add to block order
  receiptBlockOrder.push(blockId);

  // Re-render blocks and update receipt
  renderReceiptBlocks();
  updateReceiptView();

  logger.info("Added divider block");
}

// Add a standard block type to the receipt
function addStandardBlock(blockType) {
  // Check if this block type already exists
  if (receiptBlockOrder.includes(blockType)) {
    alert(
      `A ${blockType} block already exists. You can only have one of each standard block type.`,
    );
    return;
  }

  // Add to block order
  receiptBlockOrder.push(blockType);

  // Re-render blocks and update receipt
  renderReceiptBlocks();
  updateReceiptView();

  logger.info(`Added standard block: ${blockType}`);
}

function editCustomBlock(blockType) {
  const customBlockId = blockType.replace("custom_", "");
  const customBlock = customBlocks.find((block) => block.id === customBlockId);

  if (!customBlock) return;

  // Create modal container
  const modalContainer = document.createElement("div");
  modalContainer.className = "modal-container";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  // Create modal header
  const modalHeader = document.createElement("div");
  modalHeader.className = "modal-header";

  const modalTitle = document.createElement("h3");
  modalTitle.textContent = "Edit Custom Block";

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => {
    document.body.removeChild(modalContainer);
  });

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Create modal body
  const modalBody = document.createElement("div");
  modalBody.className = "modal-body";

  modalBody.innerHTML = `
        <div class="input-group">
            <label for="customBlockTitle">Block Title</label>
            <input type="text" id="customBlockTitle" value="${customBlock.title || ""}" placeholder="Enter block title" />
        </div>
        <div class="input-group">
            <label for="customBlockContent">Content</label>
            <textarea id="customBlockContent" rows="4" placeholder="Enter block content">${customBlock.content || ""}</textarea>
        </div>
        <div class="flex-row">
            <div class="input-group">
                <label for="customBlockTitleAlignment">Title Alignment</label>
                <select id="customBlockTitleAlignment">
                    <option value="left" ${customBlock.titleAlignment === "left" ? "selected" : ""}>Left</option>
                    <option value="center" ${customBlock.titleAlignment === "center" ? "selected" : ""}>Center</option>
                    <option value="right" ${customBlock.titleAlignment === "right" ? "selected" : ""}>Right</option>
                </select>
            </div>
            <div class="input-group">
                <label for="customBlockContentAlignment">Content Alignment</label>
                <select id="customBlockContentAlignment">
                    <option value="left" ${customBlock.contentAlignment === "left" ? "selected" : ""}>Left</option>
                    <option value="center" ${customBlock.contentAlignment === "center" ? "selected" : ""}>Center</option>
                    <option value="right" ${customBlock.contentAlignment === "right" ? "selected" : ""}>Right</option>
                </select>
            </div>
        </div>
    `;

  // Create modal footer
  const modalFooter = document.createElement("div");
  modalFooter.className = "modal-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(modalContainer);
  });

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "Save Changes";
  saveBtn.addEventListener("click", () => {
    const title =
      document.getElementById("customBlockTitle").value.trim() ||
      "Custom Block";
    const content = document.getElementById("customBlockContent").value;
    const titleAlignment = document.getElementById(
      "customBlockTitleAlignment",
    ).value;
    const contentAlignment = document.getElementById(
      "customBlockContentAlignment",
    ).value;

    updateCustomBlock(
      customBlockId,
      title,
      content,
      titleAlignment,
      contentAlignment,
    );
    document.body.removeChild(modalContainer);
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modalContainer.appendChild(modalContent);

  // Add to body
  document.body.appendChild(modalContainer);
}

function updateCustomBlock(
  blockId,
  title,
  content,
  titleAlignment,
  contentAlignment,
) {
  const customBlockIndex = customBlocks.findIndex(
    (block) => block.id === blockId,
  );

  if (customBlockIndex !== -1) {
    customBlocks[customBlockIndex] = {
      ...customBlocks[customBlockIndex],
      title,
      content,
      titleAlignment,
      contentAlignment,
    };

    // Re-render blocks and update receipt
    renderReceiptBlocks();
    updateReceiptView();

    logger.info(`Updated custom block "${title}"`);
  }
}

function updateCustomBlockContent(blockId, content) {
  const customBlockIndex = customBlocks.findIndex(
    (block) => block.id === blockId,
  );

  if (customBlockIndex !== -1) {
    customBlocks[customBlockIndex].content = content;
    updateReceiptView();
  }
}

function updateCustomBlockAlignment(blockId, alignment) {
  const customBlockIndex = customBlocks.findIndex(
    (block) => block.id === blockId,
  );

  if (customBlockIndex !== -1) {
    customBlocks[customBlockIndex].contentAlignment = alignment;
    updateReceiptView();
  }
}

// === Printing ===
async function printReceipt() {
  try {
    // Check if printer is connected
    if (!isPrinterConnected()) {
      logger.warn("Printer not connected");
      showPrintingStatus("Please connect to printer first", "error");
      setTimeout(() => hidePrintingStatus(), 3000);
      return;
    }

    // Show printing status
    showPrintingStatus("Printing receipt...");

    // Log print job starting
    logger.info("Starting new print job");

    // Get receipt data and render to canvas
    const receiptData = getReceiptData();
    const canvas = await renderReceipt(receiptData, items);

    logger.info("Receipt rendered", {
      width: canvas.width,
      height: canvas.height,
      items: items.length,
    });

    // Print the image
    await printImage(canvas);

    // Show success message
    showPrintingStatus("Receipt printed successfully!", "success");
    setTimeout(() => hidePrintingStatus(), 3000);
  } catch (err) {
    console.error("Print error:", err);
    logger.error("Print error", { message: err.message });
    showPrintingStatus(`Error: ${err.message}`, "error");
    setTimeout(() => hidePrintingStatus(), 5000);
  }
}

// === UI Feedback ===
function showPrintingStatus(message, type = "info") {
  // Create status bar if it doesn't exist
  let statusBar = document.querySelector(".printing-status");

  if (!statusBar) {
    statusBar = document.createElement("div");
    statusBar.className = "printing-status";
    document.body.appendChild(statusBar);
  }

  // Set color based on current mode and status type
  if (type === "info") {
    statusBar.style.backgroundColor =
      currentMode === "receipt" ? "#3182ce" : "#c53030";
  } else if (type === "success") {
    statusBar.style.backgroundColor = "#2f855a";
  } else if (type === "error") {
    statusBar.style.backgroundColor = "#c53030";
  }

  statusBar.textContent = message;
  statusBar.className = `printing-status ${type} active`;
}

function hidePrintingStatus() {
  const statusBar = document.querySelector(".printing-status");
  if (statusBar) {
    statusBar.classList.remove("active");
  }
}

// === Event Listeners ===
function setupEventListeners() {
  // Add item button
  if (addItemBtn) {
    addItemBtn.addEventListener("click", addItem);
  }

  // Item input fields
  if (newItemNameInput) {
    newItemNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addItem();
        if (newItemPriceInput) {
          newItemPriceInput.focus();
        }
      }
    });
  }

  if (newItemPriceInput) {
    newItemPriceInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addItem();
    });
  }

  // Print and reset buttons
  if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", printReceipt);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetForm);
  }

  // Payment calculation
  if (amountPaidInput) {
    amountPaidInput.addEventListener("input", calculateTotals);
  }

  if (tipAmountInput) {
    tipAmountInput.addEventListener("input", calculateTotals);
  }
}

// Optimize scroll performance for receipt blocks container
function optimizeScrollPerformance() {
  if (receiptBlocksContainer) {
    // Use passive event listeners for scroll events
    receiptBlocksContainer.addEventListener(
      "scroll",
      () => {
        // Cancel any pending updates during scroll
        if (updateReceiptViewTimeoutId) {
          clearTimeout(updateReceiptViewTimeoutId);
          updateReceiptViewTimeoutId = null;
        }
      },
      { passive: true },
    );
  }
}

// Initialize the app
init();
optimizeScrollPerformance();
