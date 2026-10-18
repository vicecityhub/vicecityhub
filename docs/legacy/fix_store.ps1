$file = 'C:\Users\sarma\Documents\deployd\v10\src\rp-hub\components\StoreTab.tsx'
$c = Get-Content $file -Raw -Encoding UTF8

$c = $c -replace 'import React, \{ useState \}', 'import React, { useState, useRef }'

$c = $c -replace '  const \[categoryFilter, setCategoryFilter\] = useState<string>', '  const plansRef = useRef<HTMLDivElement>(null);

  const scrollToPlans = () => {
    setShowPricing(true);
    setShowLeaseForm(false);
    setTimeout(() => {
      plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const [categoryFilter, setCategoryFilter] = useState<string>'

$c = $c -replace 'onClick=\{\(\) => \{ setShowPricing\(true\); setShowLeaseForm\(false\); \}\}(\r?\n\s+)className="btn-neon pulse-glow', 'onClick={scrollToPlans}$1className="btn-neon pulse-glow'

$c = $c -replace 'onClick=\{\(\) => \{ setShowPricing\(true\); setShowLeaseForm\(false\); window\.scrollTo\(\{ top: 0, behavior: ''smooth'' \}\); \}\}', 'onClick={scrollToPlans}'

$c = $c -replace '(\{showPricing && \(\r?\n\s+)<div className="mb-8 slide-in">', '$1<div ref={plansRef} className="mb-8 slide-in" style={{ scrollMarginTop: "80px" }}>'

Set-Content $file $c -Encoding UTF8
Write-Host 'Done'
