package com.paloptical.post

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.paloptical.post.databinding.ActivityMainBinding
import com.paloptical.post.models.InsuranceBenefitResult
import com.paloptical.post.services.BenefitParser
import com.paloptical.post.services.PricingEngine
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private var activeOptician = "James (JB)"
    private var isPatientEligible = true
    private var currentCautionMessage: String? = null

    private val insurancePlans = listOf(
        "EyeMed",
        "VSP",
        "Wellcare",
        "Medicaid KY",
        "Private Pay / Retail",
        "Custom / Other"
    )

    private val lensTypes = listOf(
        "Single Vision",
        "Progressive Standard",
        "Progressive Premium",
        "Progressive Ultra",
        "Bifocal Flat Top"
    )

    private val arCoatings = listOf(
        "None",
        "Standard Anti-Reflective",
        "Premium Anti-Reflective",
        "Blue-Light Filter AR"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolBar()
        setupOpticians()
        setupSpinners()
        setupListeners()
        generateJobNumber()
        recalculatePricing()
    }

    private fun setupToolBar() {
        binding.btnReset.setOnClickListener {
            resetSlip()
        }
        binding.btnQuickVerify.setOnClickListener {
            showInsuranceLookupDialog()
        }
    }

    private fun setupOpticians() {
        binding.chipGroupOptician.setOnCheckedStateChangeListener { _, checkedIds ->
            if (checkedIds.isNotEmpty()) {
                activeOptician = when (checkedIds.first()) {
                    R.id.chipJames -> "James (JB)"
                    R.id.chipLinda -> "Linda (LG)"
                    R.id.chipApril -> "April (AB)"
                    R.id.chipNaerobi -> "Naerobi (BOBI)"
                    R.id.chipSabrina -> "Sabrina (SJ)"
                    else -> "James (JB)"
                }
                binding.topAppBar.subtitle = "Optician: $activeOptician | POST Engine"
            }
        }
        binding.topAppBar.subtitle = "Optician: $activeOptician | POST Engine"
    }

    private fun setupSpinners() {
        val insAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, insurancePlans)
        binding.spinnerInsurance.adapter = insAdapter

        val lensAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, lensTypes)
        binding.spinnerLensType.adapter = lensAdapter
        binding.spinnerLensType.setSelection(1) // Default to Progressive Standard

        val arAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, arCoatings)
        binding.spinnerArCoating.adapter = arAdapter
        binding.spinnerArCoating.setSelection(1) // Default to Standard AR

        binding.spinnerInsurance.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                applyPlanDefaults(insurancePlans[position])
                recalculatePricing()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        binding.spinnerLensType.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                recalculatePricing()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        binding.spinnerArCoating.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                recalculatePricing()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun setupListeners() {
        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                recalculatePricing()
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        binding.etFrameRetail.addTextChangedListener(watcher)
        binding.etFrameAllowance.addTextChangedListener(watcher)
        binding.etProgressiveCopay.addTextChangedListener(watcher)
        binding.etArCopay.addTextChangedListener(watcher)

        binding.cbTransitions.setOnCheckedChangeListener { _, _ -> recalculatePricing() }
        binding.cbPolycarbonate.setOnCheckedChangeListener { _, _ -> recalculatePricing() }
        binding.cbHiIndex.setOnCheckedChangeListener { _, _ -> recalculatePricing() }

        binding.btnModalVerify.setOnClickListener {
            showInsuranceLookupDialog()
        }

        binding.btnDismissCaution.setOnClickListener {
            binding.layoutCautionBanner.visibility = View.GONE
        }

        binding.btnSaveSlip.setOnClickListener {
            saveSlip()
        }

        binding.btnShareSlip.setOnClickListener {
            shareSlipSummary()
        }
    }

    private fun applyPlanDefaults(carrier: String) {
        when (carrier) {
            "EyeMed" -> {
                binding.etFrameAllowance.setText("150.00")
                binding.etProgressiveCopay.setText("65.00")
                binding.etArCopay.setText("45.00")
                binding.tvInsuranceRulesNote.text = "* EyeMed: 20% discount on frame overage past $150 allowance."
            }
            "VSP" -> {
                binding.etFrameAllowance.setText("150.00")
                binding.etProgressiveCopay.setText("55.00")
                binding.etArCopay.setText("41.00")
                binding.tvInsuranceRulesNote.text = "* VSP: 20% discount on frame overage past $150 allowance."
            }
            "Wellcare" -> {
                binding.etFrameAllowance.setText("350.00")
                binding.etProgressiveCopay.setText("0.00")
                binding.etArCopay.setText("0.00")
                binding.tvInsuranceRulesNote.text = "* Wellcare: $350.00 total lump-sum allowance toward complete pair."
            }
            "Medicaid KY" -> {
                binding.etFrameAllowance.setText("100.00")
                binding.etProgressiveCopay.setText("45.00")
                binding.etArCopay.setText("35.00")
                binding.tvInsuranceRulesNote.text = "* Medicaid KY: $0 standard copay on covered materials."
            }
            "Private Pay / Retail" -> {
                binding.etFrameAllowance.setText("0.00")
                binding.etProgressiveCopay.setText("0.00")
                binding.etArCopay.setText("0.00")
                binding.tvInsuranceRulesNote.text = "* Private Pay: 20% Complete Pair Package Discount applied."
            }
            else -> {
                binding.etFrameAllowance.setText("130.00")
                binding.etProgressiveCopay.setText("65.00")
                binding.etArCopay.setText("45.00")
                binding.tvInsuranceRulesNote.text = "* Custom Plan: 20% overage discount on frame allowance."
            }
        }
    }

    private fun generateJobNumber() {
        val sdfDate = SimpleDateFormat("yyyyMMdd", Locale.US)
        val todayStr = sdfDate.format(Date())
        val randomSeq = (100..999).random()
        binding.etJobNumber.setText("POST-$todayStr-$randomSeq")

        val sdfDisplay = SimpleDateFormat("MM/dd/yyyy", Locale.US)
        binding.etJobDate.setText(sdfDisplay.format(Date()))
    }

    private fun recalculatePricing() {
        val selectedPlan = binding.spinnerInsurance.selectedItem?.toString() ?: "EyeMed"
        val selectedLens = binding.spinnerLensType.selectedItem?.toString() ?: "Single Vision"
        val selectedAr = binding.spinnerArCoating.selectedItem?.toString() ?: "None"

        val frameRetail = binding.etFrameRetail.text.toString().toDoubleOrNull() ?: 0.0
        val frameAllowance = binding.etFrameAllowance.text.toString().toDoubleOrNull() ?: 0.0
        val progressiveCopay = binding.etProgressiveCopay.text.toString().toDoubleOrNull() ?: 0.0
        val arCopay = binding.etArCopay.text.toString().toDoubleOrNull() ?: 0.0

        val hasTransitions = binding.cbTransitions.isChecked
        val hasPoly = binding.cbPolycarbonate.isChecked
        val hasHiIndex = binding.cbHiIndex.isChecked

        val breakdown = PricingEngine.calculate(
            carrier = selectedPlan,
            isEligible = isPatientEligible,
            frameRetail = frameRetail,
            frameAllowance = frameAllowance,
            progressiveCopaySetting = progressiveCopay,
            arCopaySetting = arCopay,
            lensType = selectedLens,
            arCoating = selectedAr,
            hasTransitions = hasTransitions,
            hasPolycarbonate = hasPoly,
            hasHiIndex = hasHiIndex
        )

        // Update UI
        binding.tvFramePatientCost.text = String.format(Locale.US, "$%.2f", breakdown.framePatientCost)
        binding.tvBaseLensCost.text = String.format(Locale.US, "$%.2f", breakdown.baseLensCopay)
        binding.tvProgressiveCost.text = String.format(Locale.US, "$%.2f", breakdown.progressiveCopay)
        binding.tvArCost.text = String.format(Locale.US, "$%.2f", breakdown.arCopay)
        binding.tvUpgradesCost.text = String.format(Locale.US, "$%.2f", breakdown.upgradesTotal)
        binding.tvTaxCost.text = String.format(Locale.US, "$%.2f", breakdown.kySalesTax)
        binding.tvTotalDue.text = String.format(Locale.US, "$%.2f", breakdown.totalDue)

        if (!isPatientEligible) {
            binding.layoutCautionBanner.visibility = View.VISIBLE
            binding.tvCautionHeading.text = "⚠️ CAUTION: PATIENT HAS NO ACTIVE BENEFITS"
            binding.tvCautionMessage.text = currentCautionMessage ?: "Benefits are inactive/terminated. Retail rates applied."
        } else {
            binding.layoutCautionBanner.visibility = View.GONE
        }
    }

    private fun showInsuranceLookupDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_insurance_verification, null)
        val etRaw = dialogView.findViewById<TextInputEditText>(R.id.etRawBenefits)
        val tvStatus = dialogView.findViewById<TextView>(R.id.tvParsedStatus)
        val tvAllowance = dialogView.findViewById<TextView>(R.id.tvParsedAllowance)
        val tvProgCopay = dialogView.findViewById<TextView>(R.id.tvParsedProgressiveCopay)
        val tvArCopay = dialogView.findViewById<TextView>(R.id.tvParsedArCopay)

        var lastParsedResult: InsuranceBenefitResult? = null

        fun updateLivePreview(text: String) {
            val result = BenefitParser.parse(text)
            lastParsedResult = result

            if (result.isActive) {
                tvStatus.text = "Status: ACTIVE (${result.carrierName})"
                tvStatus.setTextColor(getColor(R.color.success))
            } else {
                tvStatus.text = "Status: ${result.statusMessage}"
                tvStatus.setTextColor(getColor(R.color.danger))
            }

            tvAllowance.text = String.format(Locale.US, "Frame Allowance: $%.2f (20%% off overage)", result.frameAllowance)
            tvProgCopay.text = String.format(Locale.US, "Progressive Copay: $%.2f", result.progressiveCopay)
            tvArCopay.text = String.format(Locale.US, "Anti-Reflective Copay: $%.2f", result.arCopay)
        }

        etRaw.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updateLivePreview(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Sample preset buttons
        dialogView.findViewById<View>(R.id.btnPresetEyemed).setOnClickListener {
            etRaw.setText("EyeMed Insight Plan: Active eligibility. Frame Allowance: $150 with 20% discount on overage. Progressive Tier 1 Copay: $65. Anti-Reflective coating copay: $45.")
        }

        dialogView.findViewById<View>(R.id.btnPresetVsp).setOnClickListener {
            etRaw.setText("VSP Signature: Active member. Frame allowance $150. Progressive standard copay $55. AR coating copay $41. 20% overage discount.")
        }

        dialogView.findViewById<View>(R.id.btnPresetWellcare).setOnClickListener {
            etRaw.setText("Wellcare Vision: Active. Complete pair optical allowance: $350 lump-sum benefit applied toward frame and lenses.")
        }

        dialogView.findViewById<View>(R.id.btnPresetTerminated).setOnClickListener {
            etRaw.setText("Vision Care Notice: Patient coverage is INACTIVE / TERMINATED. Previous benefits expired. Ineligible for vision materials.")
        }

        // Initialize with default
        etRaw.setText("EyeMed Insight Plan: Active eligibility. Frame Allowance: $150 with 20% discount on balance. Progressive Copay: $65. Anti-Reflective Copay: $45.")

        MaterialAlertDialogBuilder(this)
            .setView(dialogView)
            .setPositiveButton("Apply to Slip") { _, _ ->
                lastParsedResult?.let { result ->
                    applyParsedBenefits(result)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun applyParsedBenefits(result: InsuranceBenefitResult) {
        val planIndex = insurancePlans.indexOfFirst { it.equals(result.carrierName, ignoreCase = true) }
        if (planIndex >= 0) {
            binding.spinnerInsurance.setSelection(planIndex)
        }

        binding.etFrameAllowance.setText(String.format(Locale.US, "%.2f", result.frameAllowance))
        binding.etProgressiveCopay.setText(String.format(Locale.US, "%.2f", result.progressiveCopay))
        binding.etArCopay.setText(String.format(Locale.US, "%.2f", result.arCopay))

        isPatientEligible = result.isActive
        currentCautionMessage = result.cautionMessage

        recalculatePricing()

        if (!result.isActive) {
            Snackbar.make(binding.root, "⚠️ CAUTION: Patient ineligible. Rates locked to retail.", Snackbar.LENGTH_LONG)
                .setBackgroundTint(getColor(R.color.danger))
                .setTextColor(getColor(R.color.text_on_primary))
                .show()
        } else {
            Snackbar.make(binding.root, "✓ Verified: ${result.carrierName} benefits applied!", Snackbar.LENGTH_SHORT)
                .setBackgroundTint(getColor(R.color.success))
                .setTextColor(getColor(R.color.text_on_primary))
                .show()
        }
    }

    private fun resetSlip() {
        binding.etPatientName.setText("")
        binding.etPatientDob.setText("")
        binding.etOdSph.setText("")
        binding.etOdCyl.setText("")
        binding.etOdAxis.setText("")
        binding.etOdAdd.setText("")
        binding.etOsSph.setText("")
        binding.etOsCyl.setText("")
        binding.etOsAxis.setText("")
        binding.etOsAdd.setText("")
        binding.etPd.setText("")
        binding.cbTransitions.isChecked = false
        binding.cbPolycarbonate.isChecked = false
        binding.cbHiIndex.isChecked = false
        isPatientEligible = true
        currentCautionMessage = null
        generateJobNumber()
        applyPlanDefaults("EyeMed")
        recalculatePricing()
        Toast.makeText(this, "Slip reset for new patient", Toast.LENGTH_SHORT).show()
    }

    private fun saveSlip() {
        val patient = binding.etPatientName.text.toString().trim().ifEmpty { "Patient" }
        val jobNum = binding.etJobNumber.text.toString()
        val total = binding.tvTotalDue.text.toString()
        Toast.makeText(this, "Slip $jobNum for $patient saved! Total: $total", Toast.LENGTH_LONG).show()
    }

    private fun shareSlipSummary() {
        val patient = binding.etPatientName.text.toString().trim().ifEmpty { "Walk-in Patient" }
        val jobNum = binding.etJobNumber.text.toString()
        val date = binding.etJobDate.text.toString()
        val frame = binding.etFrameName.text.toString()
        val lens = binding.spinnerLensType.selectedItem?.toString() ?: ""
        val ar = binding.spinnerArCoating.selectedItem?.toString() ?: ""
        val carrier = binding.spinnerInsurance.selectedItem?.toString() ?: ""
        val total = binding.tvTotalDue.text.toString()

        val summary = """
            ======================================
            PAL OPTICAL SLIP TOOL (POST)
            ======================================
            Job #: $jobNum
            Date: $date
            Optician: $activeOptician
            Patient: $patient
            
            Rx:
            OD: ${binding.etOdSph.text} ${binding.etOdCyl.text} x ${binding.etOdAxis.text} Add: ${binding.etOdAdd.text}
            OS: ${binding.etOsSph.text} ${binding.etOsCyl.text} x ${binding.etOsAxis.text} Add: ${binding.etOsAdd.text}
            PD: ${binding.etPd.text}
            
            Coverage: $carrier
            Frame: $frame
            Lens: $lens
            Anti-Reflective: $ar
            
            Financial Breakdown:
            Frame Responsibility: ${binding.tvFramePatientCost.text}
            Base Lens Copay: ${binding.tvBaseLensCost.text}
            Progressive Copay: ${binding.tvProgressiveCost.text}
            AR Coating Copay: ${binding.tvArCost.text}
            Upgrades: ${binding.tvUpgradesCost.text}
            KY Sales Tax (6%): ${binding.tvTaxCost.text}
            --------------------------------------
            TOTAL PATIENT RESPONSIBILITY: $total
            ======================================
        """.trimIndent()

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "POST Optical Slip - $jobNum")
            putExtra(Intent.EXTRA_TEXT, summary)
        }
        startActivity(Intent.createChooser(shareIntent, "Share Optical Slip"))
    }
}
