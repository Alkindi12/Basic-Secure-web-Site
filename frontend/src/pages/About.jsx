import './About.css';

const About = () => {
  return (
    <div className="about">
      <div className="container">
        <h1>About Tourly</h1>
        <div className="about-content">
          <section>
            <h2>Our Mission</h2>
            <p>
              At Tourly, we believe that travel is more than just visiting new places—it's about 
              creating unforgettable experiences and memories that last a lifetime. Our mission is 
              to make travel accessible, enjoyable, and meaningful for everyone.
            </p>
          </section>

          <section>
            <h2>What We Offer</h2>
            <p>
              We provide carefully curated entertainment packages and trips to amazing destinations. 
              Whether you're looking for adventure, relaxation, or cultural experiences, we have 
              something for everyone.
            </p>
          </section>

          <section>
            <h2>Why Choose Us</h2>
            <ul>
              <li>Expertly planned trips to the best destinations</li>
              <li>Experienced guides and support staff</li>
              <li>Competitive pricing with transparent fees</li>
              <li>Easy booking and management system</li>
              <li>Commitment to customer satisfaction</li>
            </ul>
          </section>

          <section>
            <h2>Contact Us</h2>
            <p>
              Have questions? Feel free to reach out to us. We're here to help make your travel 
              dreams come true.
            </p>
            <p>
              <strong>Email:</strong> utas@gmail.com<br />
              <strong>Phone:</strong> +968 777777<br />
              <strong>Address:</strong> 123 Oman, Muscat
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;




