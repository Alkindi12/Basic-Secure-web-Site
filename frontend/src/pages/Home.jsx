import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Journey to Explore World</h1>
          <p>
            We grow through simplicity and wisdom.
            Our lives are shaped by what we protect and cherish.
            Even in challenge, we rise — strengthened by purpose, grounded in experience.
          </p>
          <div className="hero-buttons">
            <button onClick={scrollToAbout} className="btn btn-primary">Learn More</button>
            <Link to="/packages" className="btn btn-secondary">Book Now</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>Why Choose Tourly?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>Best Destinations</h3>
              <p>Explore amazing places with our curated trips</p>
            </div>
            <div className="feature-card">
              <h3>Easy Booking</h3>
              <p>Simple and secure booking process</p>
            </div>
            <div className="feature-card">
              <h3>Expert Guides</h3>
              <p>Experienced guides for every adventure</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about-section" className="about-section">
        <div className="container">
          <h2>About Tourly</h2>
          <div className="about-content">
            <div className="about-item">
              <h3>Our Mission</h3>
              <p>
                At Tourly, we believe that travel is more than just visiting new places—it's about 
                creating unforgettable experiences and memories that last a lifetime. Our mission is 
                to make travel accessible, enjoyable, and meaningful for everyone.
              </p>
            </div>

            <div className="about-item">
              <h3>What We Offer</h3>
              <p>
                We provide carefully curated entertainment packages and trips to amazing destinations. 
                Whether you're looking for adventure, relaxation, or cultural experiences, we have 
                something for everyone.
              </p>
            </div>

            <div className="about-item">
              <h3>Why Choose Us</h3>
              <ul>
                <li>Expertly planned trips to the best destinations</li>
                <li>Experienced guides and support staff</li>
                <li>Competitive pricing with transparent fees</li>
                <li>Easy booking and management system</li>
                <li>Commitment to customer satisfaction</li>
              </ul>
            </div>

            <div className="about-item">
              <h3>Contact Us</h3>
              <p>
                Have questions? Feel free to reach out to us. We're here to help make your travel 
                dreams come true.
              </p>
              <div className="contact-info">
                <p><strong>Email:</strong> utas@gmail.com</p>
                <p><strong>Phone:</strong> +968 777777</p>
                <p><strong>Address:</strong> 123 Oman, Muscat</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

