// Context Menu System Implementation
class ContextMenuManager {
  constructor(editor) {
    this.editor = editor;
    this.container = editor.container;
    this.menuElement = null;
    this.isVisible = false;
    this.activeSubMenu = null;
    this.longPressTimer = null;
    this.longPressDelay = 500; // ms
    
    // Bind methods
    this.hide = this.hide.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    // Setup global event listeners
    document.addEventListener('click', this.handleClickOutside);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('contextmenu', e => {
      if (!e.target.dataset.contextMenu && !e.target._contextMenu) {
        e.preventDefault();
        this.handleClickOutside(e);
      }
    });
  }
  
  show(x, y, menuItems, options = {}) {
    // Hide existing menu
    this.hide();
    
    if (!menuItems || menuItems.length === 0) return;
    
    // Create menu element
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'context-menu';
    this.menuElement.style.position = 'fixed';
    this.menuElement.style.zIndex = '10000';
    this.menuElement.style.minWidth = '180px';
    this.menuElement.style.maxWidth = '300px';
    
    // Build menu structure
    this.buildMenu(this.menuElement, menuItems);
    
    // Position the menu
    this.positionMenu(x, y);
    
    // Add to container
    this.container.appendChild(this.menuElement);
    this.isVisible = true;
    
    // Add animation class after a small delay
    requestAnimationFrame(() => {
      this.menuElement?.classList.add('visible');
    });
  }
  
  buildMenu(parent, items, depth = 0) {
    const list = document.createElement('ul');
    list.className = `context-menu-list depth-${depth}`;
    
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'context-menu-item';
      li.setAttribute('data-index', index);
      
      // Item content container
      const content = document.createElement('div');
      content.className = 'context-menu-content';
      
      // Icon (if provided)
      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'context-menu-icon';
        icon.innerHTML = item.icon;
        content.appendChild(icon);
      }
      
      // Label
      const label = document.createElement('span');
      label.className = 'context-menu-label';
      label.textContent = item.label || item.text || '';
      content.appendChild(label);
      
      // Shortcut (if provided)
      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'context-menu-shortcut';
        shortcut.textContent = item.shortcut;
        content.appendChild(shortcut);
      }
      
      // Submenu indicator
      if (item.submenu && item.submenu.length > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'context-menu-arrow';
        arrow.textContent = '▶';
        content.appendChild(arrow);
      }
      
      li.appendChild(content);
      
      // Handle click
      if (item.action && !item.submenu) {
        li.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          item.action(e);
        });
      }
      
      // Handle submenu
      if (item.submenu && item.submenu.length > 0) {
        li.classList.add('has-submenu');
        
        let subMenuElement = null;
        
        const showSubMenu = (e) => {
          e.stopPropagation();
          
          // Hide other submenus at same depth
          const siblings = li.parentElement.querySelectorAll('li.has-submenu');
          siblings.forEach(sibling => {
            if (sibling !== li) {
              const sub = sibling.querySelector('.context-menu-sub');
              if (sub) {
                sub.classList.remove('visible');
              }
            }
          });
          
          // Create or show submenu
          if (!subMenuElement) {
            subMenuElement = document.createElement('div');
            subMenuElement.className = 'context-menu-sub';
            this.buildMenu(subMenuElement, item.submenu, depth + 1);
            li.appendChild(subMenuElement);
          }
          
          // Position submenu
          const rect = li.getBoundingClientRect();
          const subRect = subMenuElement.getBoundingClientRect();
          
          // Check if submenu fits to the right
          const rightSpace = window.innerWidth - rect.right;
          if (rightSpace > subRect.width || rightSpace > 250) {
            subMenuElement.style.left = '100%';
            subMenuElement.style.top = '0';
          } else {
            // Show to the left
            subMenuElement.style.right = '100%';
            subMenuElement.style.top = '0';
          }
          
          // Check vertical overflow
          const bottomSpace = window.innerHeight - rect.bottom;
          if (bottomSpace < subRect.height) {
            const overflow = subRect.height - bottomSpace;
            subMenuElement.style.top = `-${Math.min(overflow, rect.height / 2)}px`;
          }
          
          subMenuElement.classList.add('visible');
          this.activeSubMenu = subMenuElement;
        };
        
        const hideSubMenu = (e) => {
          if (subMenuElement) {
            // Don't hide if moving to submenu
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && subMenuElement.contains(relatedTarget)) {
              return;
            }
            subMenuElement.classList.remove('visible');
            this.activeSubMenu = null;
          }
        };
        
        li.addEventListener('mouseenter', showSubMenu);
        li.addEventListener('mouseleave', hideSubMenu);
        
        // Touch support for submenu
        li.addEventListener('click', (e) => {
          if (item.submenu && item.submenu.length > 0) {
            e.stopPropagation();
            e.preventDefault();
            
            if (subMenuElement && subMenuElement.classList.contains('visible')) {
              subMenuElement.classList.remove('visible');
              this.activeSubMenu = null;
            } else {
              showSubMenu(e);
            }
          }
        });
      }
      
      // Separator
      if (item.separator) {
        li.className = 'context-menu-separator';
        li.style.height = '1px';
        li.style.margin = '4px 8px';
        li.style.backgroundColor = 'var(--border-color, #444)';
        li.style.padding = '0';
      }
      
      // Disabled state
      if (item.disabled) {
        li.classList.add('disabled');
        li.style.opacity = '0.5';
        li.style.cursor = 'default';
      }
      
      list.appendChild(li);
    });
    
    parent.appendChild(list);
  }
  
  positionMenu(x, y) {
    if (!this.menuElement) return;
    
    // Add to DOM temporarily to measure
    this.menuElement.style.visibility = 'hidden';
    this.menuElement.style.display = 'block';
    document.body.appendChild(this.menuElement);
    
    const rect = this.menuElement.getBoundingClientRect();
    const menuWidth = rect.width;
    const menuHeight = rect.height;
    
    // Remove from body
    document.body.removeChild(this.menuElement);
    this.menuElement.style.visibility = 'visible';
    this.menuElement.style.display = '';
    
    // Calculate position
    let left = x;
    let top = y;
    
    // Check right edge
    if (x + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    
    // Check bottom edge
    if (y + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }
    
    // Ensure minimum position
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    this.menuElement.style.left = left + 'px';
    this.menuElement.style.top = top + 'px';
  }
  
  hide() {
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
    this.menuElement = null;
    this.isVisible = false;
    this.activeSubMenu = null;
  }
  
  handleClickOutside(e) {
    if (!this.isVisible) return;
    
    // Check if click is inside menu or submenu
    let target = e.target;
    while (target) {
      if (target === this.menuElement || 
          (target.classList && target.classList.contains('context-menu-sub'))) {
        return;
      }
      target = target.parentNode;
    }
    
    this.hide();
  }
  
  handleKeyDown(e) {
    if (!this.isVisible) return;
    
    if (e.key === 'Escape') {
      this.hide();
      e.preventDefault();
    }
  }
  
  getMenuFromData(element) {
    const menuData = element.dataset.contextMenu;
    if (!menuData) return null;
    
    try {
      return JSON.parse(menuData);
    } catch (e) {
      console.warn('Invalid context menu data:', e);
      return null;
    }
  }
  
  register(element, menuItems, options = {}) {
    if (!element) return;
    
    // Store menu data on element
    if (typeof menuItems === 'string') {
      element.dataset.contextMenu = menuItems;
    } else {
      element._contextMenu = menuItems;
    }
    
    // Right click
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const items = this.getMenuItems(element);
      if (items) {
        const x = options.offsetX ? e.clientX + options.offsetX : e.clientX;
        const y = options.offsetY ? e.clientY + options.offsetY : e.clientY;
        this.show(x, y, items, options);
      }
    });
  }
  
  getMenuItems(element) {
    if (element._contextMenu) {
      return element._contextMenu;
    }
    
    const data = element.dataset.contextMenu;
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }
  
  destroy() {
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.hide();
  }
}