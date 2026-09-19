"use strict";
const express = require("express");
const controller = require("../controllers/productController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const { createProductSchema, updateProductSchema, listProductsQuerySchema, idParamSchema } = require("./validators");

const router = express.Router();

router.use(requireAuth);

// Any signed-in role can browse the catalog (an agent needs it to answer
// product questions); only an admin can change it.
router.get("/", validate(listProductsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.use(requireRole(ROLES.ADMIN));
router.post("/", validate(createProductSchema), controller.create);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateProductSchema), controller.update);
router.delete("/:id", validate(idParamSchema, "params"), controller.retire);
router.post("/:id/reactivate", validate(idParamSchema, "params"), controller.reactivate);

module.exports = router;
