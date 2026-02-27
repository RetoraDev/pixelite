// File Browser class
class FileBrowser {
  constructor(options = {}) {
    // Default options
    this.options = {
      container: document.body,
      onConfirm: null,
      onCancel: null,
      onError: null,
      fileTypes: ["pxl", "png", "jpg", "jpeg"],
      defaultType: "pxl",
      allowMultiple: false,
      mode: "open", // 'open', 'save', 'saveAs'
      defaultName: "untitled"
    };
    
    this.mimeMap = {
      pxl: "text/*",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      txt: "text/plain",
      default: "*"
    };
    
    Object.assign(this.options, options);

    // State
    this.selectedFile = null;
    this.selectedType = this.options.defaultType;
    this.isCordova = typeof window.cordova !== "undefined";
    this.isFilePluginAvailable = this.isCordova && typeof window.File !== "undefined";
    this.currentDirectory = null;
    this.currentPath = null;
    this.workingDirectory = "";
    this.lastMode = null;
    this.visible = false;

    // Initialize
    this.initUI();
  }

  // UI Setup
  initUI() {
    // Overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "file-browser-overlay";
    this.overlay.style.display = "none";

    // Dialog
    this.dialog = document.createElement("div");
    this.dialog.className = "file-browser-dialog";
    this.overlay.appendChild(this.dialog);

    // Title
    this.title = document.createElement("div");
    this.title.className = "file-browser-title";
    this.title.textContent = this.options.title 
                              ? this.options.title
                              : this.options.mode === "save" 
                                || this.options.mode === "saveAs" 
                                  ? __("Guardar Archivo||Save File") : __("Abrir Archivo||Open File");
    this.dialog.appendChild(this.title);

    this.contentArea = document.createElement("div");
    this.contentArea.className = "file-browser-content";
    this.dialog.appendChild(this.contentArea);

    this.buttonContainer = document.createElement("div");
    this.buttonContainer.className = "file-browser-buttons";
    this.dialog.appendChild(this.buttonContainer);

    // Content area
    this.initContentArea();

    // Buttons
    this.initButtons();

    // Add to DOM
    this.options.container.appendChild(this.overlay);
  }

  initContentArea() {
    this.contentArea.innerHTML = "";

    // Store references to existing elements if they exist
    const existingFilenameInput = this.filenameInput;
    const existingTypeSelect = this.typeSelect;
    const existingFileList = this.fileList;

    if (this.isCordova && this.isFilePluginAvailable) {
      this.initCordovaUI();
    } else {
      this.initBrowserUI();
    }

    // Preserve values if elements were recreated
    if (existingFilenameInput && this.filenameInput && existingFilenameInput.value) {
      this.filenameInput.value = existingFilenameInput.value;
    }

    if (existingTypeSelect && this.typeSelect && existingTypeSelect.value) {
      this.typeSelect.value = existingTypeSelect.value;
      this.selectedType = existingTypeSelect.value;
    }
  }

  initCordovaUI() {
    // Clear existing content but preserve elements if they exist
    this.pathDisplay = this.pathDisplay || document.createElement("div");
    this.fileList = this.fileList || document.createElement("div");

    this.pathDisplay.className = "cordova-path";
    this.fileList.className = "file-browser-list cordova-file-list";

    this.contentArea.innerHTML = "";
    this.contentArea.appendChild(this.pathDisplay);
    this.contentArea.appendChild(this.fileList);

    // For save mode, add filename input
    if (this.options.mode === "save" || this.options.mode === "saveAs") {
      this.filenameInput = this.filenameInput || document.createElement("input");
      this.filenameInput.type = "text";
      this.filenameInput.className = "file-browser-filename";
      this.filenameInput.value = this.options.defaultName || "untitled";
      this.contentArea.appendChild(this.filenameInput);

      this.typeSelect = this.typeSelect || document.createElement("select");
      this.typeSelect.className = "file-browser-type";
      this.typeSelect.innerHTML = ""; // Clear existing options

      this.options.fileTypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type.toUpperCase();
        if (type === this.options.defaultType) option.selected = true;
        this.typeSelect.appendChild(option);
      });

      this.contentArea.appendChild(this.typeSelect);
    }
  }

  initBrowserUI() {
    this.contentArea.innerHTML = "";

    if (this.options.mode === "open") {
      // Reuse or create file input
      this.fileInput = this.fileInput || document.createElement("input");
      this.fileInput.type = "file";
      this.fileInput.style.display = "none";
      this.fileInput.accept = this.getAccept();
      this.fileInput.multiple = this.options.allowMultiple;

      // Remove existing event listeners
      const newFileInput = this.fileInput.cloneNode();
      this.fileInput = newFileInput;

      this.fileInput.addEventListener("change", e => this.handleFileSelect(e));
      this.contentArea.appendChild(this.fileInput);

      // Reuse or create browse button
      const browseButton = document.createElement("button");
      browseButton.className = "file-browser-browse";
      browseButton.textContent = __("Escoger Archivos||Browse Files");
      browseButton.addEventListener("click", () => this.fileInput.click());
      this.contentArea.appendChild(browseButton);
    } else {
      // Reuse or create filename input
      this.filenameInput = this.filenameInput || document.createElement("input");
      this.filenameInput.type = "text";
      this.filenameInput.className = "file-browser-filename";
      this.filenameInput.value = this.options.defaultName || "untitled";
      this.contentArea.appendChild(this.filenameInput);

      // Reuse or create type select
      this.typeSelect = this.typeSelect || document.createElement("select");
      this.typeSelect.className = "file-browser-type";
      this.typeSelect.innerHTML = "";

      this.options.fileTypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type.toUpperCase();
        if (type === this.options.defaultType) option.selected = true;
        this.typeSelect.appendChild(option);
      });

      this.contentArea.appendChild(this.typeSelect);
    }
  }

  initButtons() {
    this.buttonContainer.innerHTML = "";

    // Cancel button
    this.cancelButton = document.createElement("button");
    this.cancelButton.className = "file-browser-cancel";
    this.cancelButton.textContent = __("Cancelar||Cancel");
    this.cancelButton.addEventListener("click", () => this.handleCancel());
    this.buttonContainer.appendChild(this.cancelButton);

    // Confirm/Save button when appropriate
    if (this.options.mode === "save" || this.options.mode === "saveAs") {
      this.confirmButton = document.createElement("button");
      this.confirmButton.className = "file-browser-confirm";
      this.confirmButton.textContent = __("Guardar||Save");
      this.confirmButton.addEventListener("click", () => this.handleConfirm());
      this.buttonContainer.appendChild(this.confirmButton);
    }
  }

  updateExistingUI() {
    // Update filename input if it exists
    if (this.filenameInput && this.options.defaultName) {
      this.filenameInput.value = this.options.defaultName;
    }

    // Update title
    if (this.title) {
      this.title.textContent = this.options.title 
                              ? this.options.title
                              : this.options.mode === "save" 
                                || this.options.mode === "saveAs" 
                                  ? "Save File" : "Open File";
    }

    // Update others
    this.initContentArea();
    this.initButtons();
  }

  /* ====================== */
  /* === CORDOVA METHODS == */
  /* ====================== */
  async loadCordovaFiles(path = this.currentPath) {
    try {
      this.fileList.innerHTML = '<div class="loading">Loading files...</div>';

      let dirEntry;
      if (path) {
        dirEntry = await new Promise((resolve, reject) => {
          window.resolveLocalFileSystemURL(path.endsWith("/") ? path : path + "/", resolve, reject);
        });
      } else {
        // Use external storage if available (more likely to be visible)
        try {
          dirEntry = await new Promise((resolve, reject) => {
            window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory || cordova.file.dataDirectory, resolve, reject);
          });
        } catch (error) {
          // Fallback to persistent storage
          dirEntry = await new Promise((resolve, reject) => {
            window.requestFileSystem(window.PERSISTENT || 1, 0, fs => resolve(fs.root), reject);
          });
        }
      }

      // Read directory
      const reader = dirEntry.createReader();
      const entries = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      // Update UI
      this.currentDirectory = dirEntry;
      this.currentPath = dirEntry.toURL();
      this.workingDirectory = dirEntry.fullPath;
      this.updatePathDisplay(dirEntry);
      this.renderFileList(entries, dirEntry);
    } catch (error) {
      this.showError(`Error loading files: ${error.message}`);
      if (this.options.onError) this.options.onError(error);
      throw error;
    }
  }

  async getDirectoryEntry(path) {
    return new Promise((resolve, reject) => {
      window.resolveLocalFileSystemURL(path, resolve, reject);
    });
  }

  async getRootDirectory() {
    if (window.PERSISTENT) {
      return new Promise((resolve, reject) => {
        window.requestFileSystem(window.PERSISTENT, 0, fs => resolve(fs.root), reject);
      });
    } else {
      return window.cordova.file.dataDirectory;
    }
  }

  updatePathDisplay(dirEntry) {
    const path = dirEntry.fullPath || dirEntry.nativeURL;
    this.pathDisplay.textContent = path;
  }

  renderFileList(entries, dirEntry) {
    this.fileList.innerHTML = "";

    // Sort entries: directories first, then files; both alphabetically by name
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      // Both directory or both files, sort by name case-insensitive
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    if (this.isRootPath(dirEntry)) {
      // Add native open if on root directory
      if (this.options.mode === "open") {
        this.addListItem({
          text: "[File Selector]",
          icon: "folder",
          onClick: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.style.display = "none";
            input.accept = this.getAccept();
            input.multiple = this.options.allowMultiple;
            input.addEventListener("change", e => this.handleFileSelect(e));
            input.addEventListener("cancel", e => this.renderFileList(entries, dirEntry));
            input.click();
            this.fileList.innerHTML = "";
          }
        });
      }
    } else {
      // Add parent directory link if not root
      this.addParentDirectoryItem(dirEntry);
    }

    // Add files and directories
    entries.forEach(entry => {
      if (entry.isDirectory) {
        this.addDirectoryItem(entry);
      } else {
        this.addFileItem(entry);
      }
    });

    if (this.fileList.children.length === 0) {
      this.fileList.innerHTML = '<div class="empty">No files found</div>';
    }
  }
  
  addListItem({
    text = "",
    type = "directory",
    icon = "folder",
    onClick = null
  }) {
    const item = document.createElement("div");
    item.className = `file-item ${type}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = `icon ${icon}`;

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    item.appendChild(iconSpan);
    item.appendChild(textSpan);

    item.addEventListener("click", () => onClick?.(item));
    
    item.addEventListener("touchend", () => item.scrollTo({ left: 0, behavior: "smooth" }));
    
    this.fileList.appendChild(item);
  }

  addParentDirectoryItem(dirEntry) {
    const parentItem = document.createElement("div");
    parentItem.className = "file-item directory";

    // Clear innerHTML, create icon div and text span instead
    const icon = document.createElement("span");
    icon.className = "icon folder";

    const text = document.createElement("span");
    text.textContent = ".. (Parent Directory)";

    parentItem.appendChild(icon);
    parentItem.appendChild(text);

    parentItem.addEventListener("click", () => this.goUp());
    this.fileList.appendChild(parentItem);
  }

  addDirectoryItem(entry) {
    const item = document.createElement("div");
    item.className = "file-item directory";

    const icon = document.createElement("span");
    icon.className = "icon folder";

    const text = document.createElement("span");
    text.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(text);

    item.addEventListener("click", () => {
      this.loadCordovaFiles(entry.toURL());
    });
    
    item.addEventListener("touchend", () => item.scrollTo({ left: 0, behavior: "smooth" }));
    
    this.fileList.appendChild(item);
  }

  addFileItem(entry) {
    const ext = entry.name.split(".").pop().toLowerCase();
    if (!this.options.fileTypes.includes(ext)) return;

    const item = document.createElement("div");
    item.className = "file-item file";

    const icon = document.createElement("span");

    // Decide icon based on file type
    if (["png", "gif", "jpg", "jpeg"].includes(ext)) {
      icon.className = "icon image-file";
    } else if (ext === "pxl") {
      icon.className = "icon project-file";
    } else {
      icon.className = "icon text-file";
    }

    const text = document.createElement("span");
    text.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(text);

    item.addEventListener("click", () => {
      this.selectedFile = entry;
      this.selectedType = ext;

      if (this.options.mode === "open" && this.options.onConfirm) {
        this.options.onConfirm({
          name: entry.name,
          type: ext,
          entry: entry,
          fullPath: entry.toURL()
        });
        this.hide();
      } else {
        this.filenameInput.value = entry.name;
      }
    });
    this.fileList.appendChild(item);
  }

  /* ====================== */
  /* === BROWSER METHODS == */
  /* ====================== */
  handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const ext = file.name.split(".").pop().toLowerCase();

    if (this.options.onConfirm) {
      this.options.onConfirm({
        name: file.name,
        type: ext,
        file: file
      });
    }

    this.hide();
  }

  /* ====================== */
  /* ==== CORE METHODS ==== */
  /* ====================== */
  show() {
    // Make sure UI is initialized for current mode
    if (this.lastMode !== this.options.mode) {
      this.contentArea.innerHTML = "";
      this.initContentArea();
    }

    this.overlay.style.display = "flex";
    this.selectedFile = null;
    this.visible = true;

    // Reset or update UI elements based on mode
    if (this.filenameInput) {
      this.filenameInput.value = this.options.defaultName || "untitled";
    }

    if (this.typeSelect && this.options.defaultType) {
      this.typeSelect.value = this.options.defaultType;
      this.selectedType = this.options.defaultType;
    }

    if (this.isCordova && this.isFilePluginAvailable) {
      this.loadCordovaFiles();
    }
  }

  hide() {
    this.overlay.style.display = "none";
    this.visible = false;
  }

  refresh() {
    this.contentArea.innerHTML = "";
    this.initContentArea();

    if (this.isCordova && this.isFilePluginAvailable) {
      this.loadCordovaFiles();
    }
  }

  goUp() {
    if (!this.isRootPath(this.currentDirectory)) {
      this.loadCordovaFiles(this.currentDirectory.toURL().split("/").slice(0, -2).join("/") || "/");
    } else {
      this.hide();
    }
  }

  isRootPath(dirEntry) {
    return dirEntry.fullPath == "/" || dirEntry.fullPath == cordova.file.dataDirectory;
  }
  
  getAccept() {
    const mimeStack = [];
    this.options.fileTypes.forEach(extension => {
      const type = this.mimeMap[extension] || this.mimeMap.default;
      const mimes = type.split(',').map(mime => mime.trim());
      mimes.forEach(mime => {
        if (!mimeStack.includes(mime)) {
          mimeStack.push(mime);
        }
      });
    });
    return mimeStack.join(', ');
  }

  updateOptions(newOptions) {
    const oldMode = this.options.mode;
    Object.assign(this.options, newOptions);
    this.selectedFile = null;
    this.selectedType = this.options.defaultType || "pxl";

    // Re-initialize UI if mode changed or UI elements don't exist
    if (oldMode !== this.options.mode || (this.options.mode === "saveAs" && !this.filenameInput) || (this.options.mode === "open" && this.isCordova && !this.fileList)) {
      this.contentArea.innerHTML = "";
      this.initContentArea();
      this.updateExistingUI();
    } else {
      this.updateExistingUI();
    }

    this.lastMode = this.options.mode;
  }

  handleConfirm() {
    if (this.options.mode !== "save" && this.options.mode !== "saveAs") return;

    let filename = this.filenameInput ? this.filenameInput.value.trim() : this.options.defaultName;
    if (!filename) filename = this.options.defaultName;

    const fileType = this.typeSelect ? this.typeSelect.value : this.options.defaultType;
    const fullFilename = filename.endsWith(`.${fileType}`) ? filename : `${filename}.${fileType}`;

    if (this.options.onConfirm) {
      const result = {
        name: fullFilename,
        type: fileType
      };

      if (this.isCordova && this.isFilePluginAvailable && this.currentDirectory) {
        result.directory = this.currentDirectory;
      }

      this.options.onConfirm(result);
    }

    this.hide();
  }

  handleCancel() {
    if (this.options.onCancel) {
      this.options.onCancel();
    }
    this.hide();
  }

  showError(message) {
    this.fileList.innerHTML = `<div class="error">${message}</div>`;
  }

  destroy() {
    // Remove event listeners from file input
    if (this.fileInput) {
      const newFileInput = this.fileInput.cloneNode(false);
      this.fileInput.parentNode?.replaceChild(newFileInput, this.fileInput);
      this.fileInput = newFileInput;
    }

    // Remove overlay
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    this.fileBrowser = null;
  }
}
