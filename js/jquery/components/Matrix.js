/**
 * @copyright   2010-2014, The Titon Project
 * @license     http://opensource.org/licenses/BSD-3-Clause
 * @link        http://titon.io
 */

Toolkit.Matrix = Toolkit.Component.extend(function(element, options) {
    this.component = 'Matrix';
    this.version = '1.5.0';
    this.element = element = $(element).addClass(vendor + 'matrix');
    this.options = options = this.setOptions(options, element);

    // Items within the matrix
    this.items = [];

    // List of items in order and how many columns they span horizontally
    this.matrix = [];

    // Width of the wrapper (target element)
    // Is recalculated every page resize to determine columns
    this.wrapperWidth = 0;

    // Calculated final width of the column (may differ from width option)
    this.colWidth = 0;

    // Height of each column
    this.colHeights = [];

    // How many columns that can fit in the wrapper
    this.colCount = 0;

    // Collection of img elements
    this.images = [];

    // Initialize events
    this.events = {
        'resize window': $.debounce(this.onResize)
    };

    this.initialize();

    // Render the matrix
    if (options.defer) {
        this._deferRender();
    } else {
        this.refresh();
    }
}, {

    /**
     * Append an item to the bottom of the matrix.
     *
     * @param {jQuery} item
     */
    append: function(item) {
        $(item)
            .appendTo(this.element)
            .css('opacity', 0);

        this.refresh();
    },

    /**
     * Remove inline styles before destroying.
     */
    doDestroy: function() {
        this.element.removeAttr('style');
        this.items.removeAttr('style');
    },

    /**
     * Prepend an item to the top of the matrix.
     *
     * @param {jQuery} item
     */
    prepend: function(item) {
        $(item)
            .prependTo(this.element)
            .css('opacity', 0);

        this.refresh();
    },

    /**
     * Fetch new items and re-render the grid.
     */
    refresh: function() {
        this.items = this.element.find('> li').each(function() {
            var self = $(this);

            // Cache the initial column width
            self.addData('matrix-column-width', self.outerWidth());
        });

        this.render();
    },

    /**
     * Remove an item from the grid (and DOM) and re-render.
     *
     * @param {jQuery} item
     */
    remove: function(item) {
        this.items.each(function() {
            var self = $(this);

            if (self.is(item)) {
                self.remove();
                return false;
            }

            return true;
        });

        this.refresh();
    },

    /**
     * Calculate and position items in the grid.
     */
    render: function() {
        this._calculateColumns();

        var element = this.element,
            items = this.items;

        // No items
        if (!items.length) {
            element.removeAttr('style');

        // Single column
        } else if (this.colCount <= 1) {
            element.removeAttr('style').addClass('no-columns');
            items.removeAttr('style');

        // Multi column
        } else {
            element.removeClass('no-columns');

            this._organizeItems();
            this._positionItems();
        }

        this.fireEvent('render');
    },

    /**
     * Calculate how many columns can be supported in the current resolution.
     * Modify the column width to account for gaps on either side.
     *
     * @private
     */
    _calculateColumns: function() {
        var wrapperWidth = this.element.outerWidth(),
            colWidth = this.options.width,
            gutter = this.options.gutter,
            cols = Math.max(Math.floor(wrapperWidth / colWidth), 1),
            colsWidth = (cols * (colWidth + gutter)) - gutter,
            diff;

        if (cols > 1) {
            if (colsWidth > wrapperWidth) {
                diff = colsWidth - wrapperWidth;
                colWidth -= (diff / cols);

            } else if (colsWidth < wrapperWidth) {
                diff = wrapperWidth - colsWidth;
                colWidth += (diff / cols);
            }
        }

        this.wrapperWidth = wrapperWidth;
        this.colWidth = colWidth;
        this.colCount = cols;
    },

    /**
     * Fetch all images within the matrix and attach an onload event.
     * This will monitor loaded images and render once all are complete.
     * Uses a src swap trick to force load cached images.
     *
     * @private
     */
    _deferRender: function() {
        var promises = [];

        this.images = this.element.find('img').each(function(index, image) {
            var src = image.src,
                def = $.Deferred();

            image.onload = def.resolve;
            image.onerror = image.onabort = def.reject;
            image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
            image.src = src;

            promises.push(def.promise());
        });

        $.when.apply($, promises).always(this.refresh);
    },

    /**
     * Organize the items into columns by looping over each item and calculating dimensions.
     * If an item spans multiple columns, account for it by filling with an empty space.
     *
     * @private
     */
    _organizeItems: function() {
        var item,
            span,
            size,
            l = this.items.length;

        this.matrix = [];

        for (var i = 0; i < l; i++) {
            item = this.items.eq(i);
            size = item.data('matrix-column-width');

            // How many columns does this item span?
            span = Math.max(Math.round(size / this.colWidth), 1);

            // Span cannot be larger than the total number of columns
            if (span > this.colCount) {
                span = this.colCount;
            }

            this.matrix.push({
                item: item,
                span: span
            });

            // Multiple columns
            if (span > 1) {
                for (var s = 1; s < span; s++) {
                    if (this.matrix) {
                        this.matrix.push({
                            item: item,
                            span: false // Indicates an empty space
                        });
                    }
                }
            }
        }
    },

    /**
     * Loop through the items in each column and position them absolutely.
     *
     * @private
     */
    _positionItems: function() {
        var gutter = this.options.gutter,
            items = this.matrix,
            item,
            span,
            dir = this.options.rtl ? 'right' : 'left',
            y = [], // The top position values indexed by column
            c = 0, // Current column in the loop
            h = 0, // Smallest height column
            i, // Items loop counter
            l, // Items length
            s, // Current span column in the loop
            top,
            pos = { margin: 0, position: 'absolute' };

        for (i = 0; i < this.colCount; i++) {
            y.push(0);
        }

        for (i = 0, l = items.length; i < l; i++) {
            item = items[i];
            span = item.span;

            // Place the item in the smallest column
            h = -1;

            for (s = 0; s < this.colCount; s++) {
                if (h === -1 || y[s] < h) {
                    h = y[s];
                    c = s;
                }
            }

            // If the item extends too far out, move it to the next column
            // Or if the last column has been reached
            if ((c >= this.colCount) || ((span + c) > this.colCount)) {
                c = 0;
            }

            // Item spans a column or multiple columns
            if (span) {
                top = 0;

                // If the item spans multiple columns
                // Get the largest height from the previous row
                for (s = 0; s < span; s++) {
                    if (y[c + s] > top) {
                        top = y[c + s];
                    }
                }

                // Position the item
                pos.top = top;
                pos[dir] = (this.colWidth + gutter) * c;
                pos.width = ((this.colWidth + gutter) * span) - gutter;

                item.item.css(pos).reveal();

                // Loop again to add the value to each columns Y top value
                // This must be done after positioning so we can calculate a new size
                for (s = 0; s < span; s++) {
                    y[c + s] = item.item.outerHeight() + gutter + top;
                }
            }

            this.colHeights[c] = y[c];

            c++;
        }

        // Set height of wrapper
        this.element.css('height', Math.max.apply(Math, y));
    },

    /**
     * Event handler for browser resizing.
     *
     * @private
     */
    onResize: function() {
        this.refresh();
    }

}, {
    width: 200,
    gutter: 20,
    rtl: false,
    defer: true
});

Toolkit.create('matrix', function(options) {
    return new Toolkit.Matrix(this, options);
});