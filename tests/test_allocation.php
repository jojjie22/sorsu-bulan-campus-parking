<?php
// Dependency-free algorithm unit tests; no database connection required.
require_once __DIR__.'/../backend/allocation.php';
function expect(bool $condition,string $message): void {
    if(!$condition){fwrite(STDERR,"FAIL: $message\n");exit(1);}
}
expect(allocationScore(false,50,0.5,false)===40.0,'default weighting');
expect(allocationScore(true,50,0.5,false)===140.0,'preference bonus');
expect(allocationScore(false,100,1.0,true)===85.0,'maximum non-preferred score');
expect(allocationScore(false,500,2.0,true)===85.0,'input clamping');
expect(allocationScore(true,0,0,false)>allocationScore(false,100,1,true),'preference wins');
echo "Allocation scoring tests passed.\n";
