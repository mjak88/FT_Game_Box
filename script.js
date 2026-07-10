function goToInput() {
    // Logic to hide current div and show the input form
    document.body.innerHTML = `
        <div class="center-content">
            <input type="tel" id="phone" placeholder="Enter Mobile Number">
            <input type="text" id="coupon" placeholder="Enter Coupon">
            <button onclick="validateAndPlay()">Next</button>
        </div>
    `;
}

async function validateAndPlay() {
    const coupon = document.getElementById('coupon').value;
    // You will call your Google Apps Script URL here
    const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL?coupon=' + coupon);
    const data = await response.json();
    
    if(data.isValid) {
        alert("Valid! Starting Game...");
        // Redirect to a randomly chosen game page
    } else {
        alert("Invalid Coupon");
    }
}