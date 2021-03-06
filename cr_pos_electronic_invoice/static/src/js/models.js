/* Copyright 2016 David Gómez Quilón <david.gomez@aselcis.com>
   License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
*/

odoo.define('pos_electronic_invoice.models', function (require) {
    "use strict";

    var models = require('point_of_sale.models');


    var pos_super = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (attributes, options) {
            pos_super.initialize.apply(this, arguments);
            this.pushed_simple_invoices = [];
            return this;
        },

        get_simple_inv_next_number: function () {
            if (this.pushed_simple_invoices.indexOf(this.config.ticket_hacienda_invoice_number) > -1) {
                ++this.config.ticket_hacienda_invoice_number;
            }
            return this.config.ticket_hacienda_invoice_prefix+ this.config.ticket_hacienda_invoice_number;
        },

        push_simple_invoice: function (order) {
            if (this.pushed_simple_invoices.indexOf(order.data.simplified_invoice) === -1) {
                this.pushed_simple_invoices.push(order.data.simplified_invoice);
                ++this.config.ticket_hacienda_invoice_number;
            }
        },
        _flush_orders: function (orders, options) {
            var self = this;
            // Save pushed orders numbers
            _.each(orders, function (order) {
                if (!order.data.to_invoice) {
                    self.push_simple_invoice(order);
                }
            });
            return pos_super._flush_orders.apply(this, arguments);
        }
    });

    var order_super = models.Order.prototype;
    models.Order = models.Order.extend({
        set_simple_inv_number: function () {
            this.simplified_invoice = this.pos.get_simple_inv_next_number();
        },
        get_base_by_tax: function () {
            var base_by_tax = {};
            this.get_orderlines().forEach(function (line) {
                var tax_detail = line.get_tax_details();
                var base_price = line.get_price_without_tax();
                if (tax_detail) {
                    Object.keys(tax_detail).forEach(function (tax) {
                        if (Object.keys(base_by_tax).includes(tax)) {
                            base_by_tax[tax] += base_price;
                        } else {
                            base_by_tax[tax] = base_price;
                        }
                    });
                }
            });
            return base_by_tax;
        },
        init_from_JSON: function (json) {
            order_super.init_from_JSON.apply(this, arguments);
            this.to_invoice = json.to_invoice;
            this.simplified_invoice = json.simplified_invoice;
        },
        export_as_JSON: function () {
            var res = order_super.export_as_JSON.apply(this, arguments);
            res.to_invoice = this.is_to_invoice();
            if (!res.to_invoice) {
                res.simplified_invoice = this.simplified_invoice;
            }
            return res;
        }
    });

    models.load_fields('res.company', ['street', 'city', 'state_id', 'zip']);

});
